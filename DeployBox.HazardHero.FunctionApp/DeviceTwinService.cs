using Microsoft.Azure.Devices;
using Microsoft.Azure.Devices.Shared;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace DeployBox.HazardHero.FunctionApp;

public interface IDeviceTwinService
{
    Task<DeviceTwinUpdateResult> UpdateAsync(
        string deviceId,
        string? operationalStatus,
        string? connectivityStatus,
        CancellationToken cancellationToken);
}

public sealed class DeviceTwinService : IDeviceTwinService, IDisposable
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<DeviceTwinService> _logger;
    private readonly Lazy<RegistryManager?> _registryManager;

    public DeviceTwinService(
        IConfiguration configuration,
        ILogger<DeviceTwinService> logger)
    {
        _configuration = configuration;
        _logger = logger;
        _registryManager = new Lazy<RegistryManager?>(CreateRegistryManager);
    }

    public async Task<DeviceTwinUpdateResult> UpdateAsync(
        string deviceId,
        string? operationalStatus,
        string? connectivityStatus,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        if (!DeviceRequestValidation.IsValidDeviceId(deviceId))
        {
            throw new ArgumentException(
                "deviceId must be between 1 and 255 characters.",
                nameof(deviceId));
        }

        if (operationalStatus is null && connectivityStatus is null)
        {
            throw new ArgumentException(
                "At least one twin status value is required.",
                nameof(operationalStatus));
        }

        var registryManager = _registryManager.Value;
        if (registryManager is null)
        {
            _logger.LogWarning(
                "IoT Hub device twin update skipped for device {DeviceId}; IotHubConnectionString is not configured.",
                deviceId);
            return new DeviceTwinUpdateResult(
                DeviceTwinUpdateStatus.NotConfigured);
        }

        var twin = new Twin();
        if (operationalStatus is not null)
        {
            twin.Properties.Desired["operational_status"] = operationalStatus;
        }

        if (connectivityStatus is not null)
        {
            twin.Properties.Desired["connectivityStatus"] = connectivityStatus;
        }

        await registryManager.UpdateTwinAsync(
            deviceId,
            twin,
            "*",
            cancellationToken);

        _logger.LogInformation(
            "Updated IoT Hub device twin for device {DeviceId}.",
            deviceId);

        return new DeviceTwinUpdateResult(DeviceTwinUpdateStatus.Updated);
    }

    public void Dispose()
    {
        if (_registryManager.IsValueCreated)
        {
            _registryManager.Value?.Dispose();
        }
    }

    private RegistryManager? CreateRegistryManager()
    {
        var connectionString = _configuration["IotHubConnectionString"];
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return null;
        }

        return RegistryManager.CreateFromConnectionString(connectionString);
    }
}

public sealed record DeviceTwinUpdateResult(DeviceTwinUpdateStatus Status);

public enum DeviceTwinUpdateStatus
{
    NotConfigured,
    Updated
}
