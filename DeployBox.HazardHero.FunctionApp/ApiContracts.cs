namespace DeployBox.HazardHero.FunctionApp;

public sealed record ApiErrorResponse(ApiError Error);

public sealed record ApiError(
    string Code,
    string Message,
    string? CurrentStatus = null);

public sealed record DeviceActionResponse(
    string DeviceId,
    string? OperationalStatus);

public sealed record HealthResponse(
    string Status,
    bool IotHubConfigured);

public sealed record DeviceResponse(
    string DeviceId,
    string? SerialNumber,
    string? ModelCode,
    string? HardwareRevision,
    string? FirmwareVersion,
    string LifecycleStatus,
    string ConnectivityStatus,
    string OperationalStatus,
    int BatteryPercentage,
    DateTime? LastSeenAt,
    DateTime CreatedAt,
    DateTime UpdatedAt)
{
    public static DeviceResponse FromRecord(DeviceRecord device)
    {
        return new DeviceResponse(
            device.DeviceId,
            device.SerialNumber,
            device.ModelCode,
            device.HardwareRevision,
            device.FirmwareVersion,
            device.LifecycleStatus,
            device.ConnectivityStatus,
            device.OperationalStatus,
            device.BatteryPercentage,
            device.LastSeenAt,
            device.CreatedAt,
            device.UpdatedAt);
    }
}

public static class DeviceRequestValidation
{
    public static bool IsValidDeviceId(string? deviceId)
    {
        return !string.IsNullOrWhiteSpace(deviceId) &&
               deviceId.Length <= 255;
    }
}
