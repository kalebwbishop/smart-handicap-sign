using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;

namespace DeployBox.HazardHero.FunctionApp;

public class DeviceEndpoints
{
    private readonly SignalClassificationResultRepository _repository;
    private readonly IDeviceTwinService _deviceTwinService;

    public DeviceEndpoints(
        SignalClassificationResultRepository repository,
        IDeviceTwinService deviceTwinService)
    {
        _repository = repository;
        _deviceTwinService = deviceTwinService;
    }

    [Function("ListDevices")]
    public async Task<IActionResult> List(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "devices")]
        HttpRequest request,
        CancellationToken cancellationToken)
    {
        var devices = await _repository.GetDevicesAsync(cancellationToken);
        return new OkObjectResult(devices.Select(DeviceResponse.FromRecord));
    }

    [Function("GetDeviceById")]
    public async Task<IActionResult> GetById(
        [HttpTrigger(
            AuthorizationLevel.Anonymous,
            "get",
            Route = "devices/{deviceId}")]
        HttpRequest request,
        string deviceId,
        CancellationToken cancellationToken)
    {
        if (!DeviceRequestValidation.IsValidDeviceId(deviceId))
        {
            return new BadRequestObjectResult(new ApiErrorResponse(
                new ApiError(
                    "INVALID_DEVICE_ID",
                    "deviceId must be between 1 and 255 characters.")));
        }

        var device = await _repository.GetDeviceAsync(deviceId, cancellationToken);
        if (device is null)
        {
            return new NotFoundObjectResult(new ApiErrorResponse(
                new ApiError(
                    "DEVICE_NOT_FOUND",
                    "The requested device does not exist.")));
        }

        return new OkObjectResult(DeviceResponse.FromRecord(device));
    }

    [Function("ResolveDevice")]
    public async Task<IActionResult> Resolve(
        [HttpTrigger(
            AuthorizationLevel.Anonymous,
            "post",
            Route = "devices/{deviceId}/resolve")]
        HttpRequest request,
        string deviceId,
        CancellationToken cancellationToken)
    {
        if (!DeviceRequestValidation.IsValidDeviceId(deviceId))
        {
            return new BadRequestObjectResult(new ApiErrorResponse(
                new ApiError(
                    "INVALID_DEVICE_ID",
                    "deviceId must be between 1 and 255 characters.")));
        }

        var result = await _repository.ResolveDeviceAsync(
            deviceId,
            cancellationToken);

        if (!result.Exists)
        {
            return new NotFoundObjectResult(new ApiErrorResponse(
                new ApiError(
                    "DEVICE_NOT_FOUND",
                    "The requested device does not exist.")));
        }

        if (!result.Resolved)
        {
            return new ConflictObjectResult(new ApiErrorResponse(
                new ApiError(
                    "DEVICE_NOT_RESOLVABLE",
                    "The device is not currently in progress.",
                    result.OperationalStatus)));
        }

        await _deviceTwinService.UpdateAsync(
            deviceId,
            result.OperationalStatus,
            null,
            cancellationToken);

        return new OkObjectResult(new DeviceActionResponse(
            deviceId,
            result.OperationalStatus));
    }
}
