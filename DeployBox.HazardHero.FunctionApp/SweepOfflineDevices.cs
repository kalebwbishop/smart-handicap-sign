using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;

namespace DeployBox.HazardHero.FunctionApp;

public class SweepOfflineDevices
{
    private static readonly TimeSpan StaleThreshold = TimeSpan.FromMinutes(5);

    private readonly ILogger<SweepOfflineDevices> _logger;
    private readonly SignalClassificationResultRepository _repository;
    private readonly IDeviceNotificationService _notificationService;

    public SweepOfflineDevices(
        ILogger<SweepOfflineDevices> logger,
        SignalClassificationResultRepository repository,
        IDeviceNotificationService notificationService)
    {
        _logger = logger;
        _repository = repository;
        _notificationService = notificationService;
    }

    [Function("SweepOfflineDevices")]
    public async Task Run(
        [TimerTrigger("0 */5 * * * *")] TimerInfo timer,
        CancellationToken cancellationToken)
    {
        var cutoff = DateTime.UtcNow - StaleThreshold;
        var deviceIds = await _repository.MarkStaleDevicesOfflineAsync(
            cutoff,
            cancellationToken);

        foreach (var deviceId in deviceIds)
        {
            await _notificationService.SendAsync(
                new DeviceNotification(
                    deviceId,
                    "device_offline",
                    "Device offline",
                    "A device has stopped reporting its status.",
                    new Dictionary<string, string>
                    {
                        ["target"] = "home"
                    }),
                cancellationToken);
        }

        _logger.LogInformation(
            "Offline device sweep marked {DeviceCount} device(s) offline.",
            deviceIds.Count);
    }
}
