// Extension: hazard-hero-esp32
// Build, flash, and capture serial logs for the firmware/ ESP32 pilot board.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { joinSession } from "@github/copilot-sdk/extension";

const extensionFile = fileURLToPath(import.meta.url);
const extensionDir = path.dirname(extensionFile);
const repoRoot = path.resolve(extensionDir, "..", "..", "..");
const firmwareDir = path.join(repoRoot, "firmware");
const helperScript = path.join(firmwareDir, "README.md");

function toolResult(textResultForLlm, resultType = "success") {
    return { textResultForLlm, resultType };
}

function validateSetup() {
    if (!existsSync(firmwareDir)) {
        return `Error: firmware directory not found at ${firmwareDir}.`;
    }

    if (!existsSync(helperScript)) {
        return `Error: firmware README not found at ${helperScript}.`;
    }

    return null;
}

function commandCandidates() {
    if (process.platform === "win32") {
        return [["idf.py"], ["python", "-m", "idf.py"], ["py", "-3", "-m", "idf.py"]];
    }

    return [["idf.py"], ["python3", "-m", "idf.py"], ["python", "-m", "idf.py"]];
}

function pythonCandidates() {
    if (process.platform === "win32") {
        return [["python"], ["py", "-3"]];
    }

    return [["python3"], ["python"]];
}

function runProcess(command, args, options = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            cwd: firmwareDir,
            env: {
                ...process.env,
                PYTHONIOENCODING: "utf-8",
            },
            stdio: ["pipe", "pipe", "pipe"],
            shell: process.platform === "win32",
        });

        let stdout = "";
        let stderr = "";

        child.stdout.on("data", (chunk) => {
            stdout += chunk.toString();
        });

        child.stderr.on("data", (chunk) => {
            stderr += chunk.toString();
        });

        let timer;
        if (options.timeoutMs) {
            timer = setTimeout(() => {
                child.kill();
            }, options.timeoutMs);
        }

        child.on("error", reject);
        child.on("close", (code) => {
            if (timer) {
                clearTimeout(timer);
            }

            resolve({
                code,
                stdout: stdout.trim(),
                stderr: stderr.trim(),
            });
        });

        if (options.stdin) {
            child.stdin.end(options.stdin);
        } else {
            child.stdin.end();
        }
    });
}

async function runIdfPy(args, extra = {}) {
    let lastError = "Error: unable to run idf.py.";

    for (const candidate of commandCandidates()) {
        const [command, ...baseArgs] = candidate;

        try {
            const result = await runProcess(command, [...baseArgs, ...args], extra);

            if (result.code === 0) {
                return toolResult(result.stdout || "Command completed successfully.");
            }

            lastError = result.stderr || result.stdout || `Error: ${command} exited with code ${result.code}.`;
        } catch (error) {
            lastError = `Error: failed to start ${command}: ${error.message}`;
        }
    }

    return toolResult(lastError, "failure");
}

async function captureLogs(args) {
    const setupError = validateSetup();
    if (setupError) {
        return toolResult(setupError, "failure");
    }

    const port = typeof args?.port === "string" ? args.port.trim() : "";
    if (!port) {
        return toolResult("Error: port is required.", "failure");
    }

    const baud = Number.isInteger(args?.baud) ? args.baud : 115200;
    const durationSeconds = Number.isInteger(args?.duration_seconds) ? args.duration_seconds : 15;

    if (durationSeconds < 1 || durationSeconds > 300) {
        return toolResult("Error: duration_seconds must be between 1 and 300.", "failure");
    }

    const pythonSnippet = String.raw`
import sys
import time

try:
    import serial
except ModuleNotFoundError:
    print("Error: pyserial is required. Install it with: py -m pip install pyserial", file=sys.stderr)
    raise SystemExit(1)

port = sys.argv[1]
baud = int(sys.argv[2])
duration = int(sys.argv[3])

try:
    with serial.Serial(port, baudrate=baud, timeout=0.2) as device:
        device.reset_input_buffer()
        end = time.time() + duration
        while time.time() < end:
            line = device.readline()
            if line:
                sys.stdout.write(line.decode("utf-8", errors="replace"))
                sys.stdout.flush()
except serial.SerialException as error:
    print(f"Error: unable to open {port}: {error}", file=sys.stderr)
    raise SystemExit(1)
`;

    let lastError = "Error: unable to capture ESP32 logs.";

    for (const candidate of pythonCandidates()) {
        const [command, ...baseArgs] = candidate;

        try {
            const result = await runProcess(command, [...baseArgs, "-c", pythonSnippet, port, String(baud), String(durationSeconds)], {
                timeoutMs: (durationSeconds + 5) * 1000,
            });

            if (result.code === 0) {
                return toolResult(result.stdout || "No log lines were captured during the requested window.");
            }

            lastError = result.stderr || result.stdout || `Error: ${command} exited with code ${result.code}.`;
        } catch (error) {
            lastError = `Error: failed to start ${command}: ${error.message}`;
        }
    }

    return toolResult(lastError, "failure");
}

await joinSession({
    tools: [
        {
            name: "hazard_hero_esp32_build",
            description: "Build the ESP32 firmware in the firmware/ directory with idf.py build.",
            parameters: {
                type: "object",
                properties: {},
            },
            handler: async () => runIdfPy(["build"]),
        },
        {
            name: "hazard_hero_esp32_flash",
            description: "Flash the built firmware to an ESP32 over a serial port with idf.py flash.",
            parameters: {
                type: "object",
                properties: {
                    port: {
                        type: "string",
                        description: "Serial port such as COM3 or /dev/ttyUSB0.",
                    },
                    baud: {
                        type: "integer",
                        description: "Flash baud rate. Defaults to 460800.",
                        default: 460800,
                    },
                },
                required: ["port"],
            },
            handler: async (args) =>
                runIdfPy(["-p", args.port, "-b", String(args?.baud ?? 460800), "flash"]),
        },
        {
            name: "hazard_hero_esp32_logs",
            description: "Capture a bounded window of serial logs from an ESP32 and return the text output.",
            parameters: {
                type: "object",
                properties: {
                    port: {
                        type: "string",
                        description: "Serial port such as COM3 or /dev/ttyUSB0.",
                    },
                    baud: {
                        type: "integer",
                        description: "Serial baud rate. Defaults to 115200.",
                        default: 115200,
                    },
                    duration_seconds: {
                        type: "integer",
                        description: "How long to read logs before returning. Defaults to 15 seconds.",
                        default: 15,
                        minimum: 1,
                        maximum: 300,
                    },
                },
                required: ["port"],
            },
            handler: async (args) => captureLogs(args),
        },
    ],
});
