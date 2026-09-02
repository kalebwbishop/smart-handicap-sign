using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;

namespace DeployBox.HazardHero.FunctionApp;

public class AcknowledgeDevice
{
    private readonly SignalClassificationResultRepository _repository;

    public AcknowledgeDevice(SignalClassificationResultRepository repository)
    {
        _repository = repository;
    }

    [Function("AcknowledgeDevice")]
    public async Task<IActionResult> Run(
        [HttpTrigger(
            AuthorizationLevel.Anonymous,
            "post",
            Route = "devices/{deviceId}/acknowledge")]
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

        var result = await _repository.AcknowledgeDeviceAsync(
            deviceId,
            cancellationToken);

        if (!result.Exists)
        {
            return new NotFoundObjectResult(new ApiErrorResponse(
                new ApiError(
                    "DEVICE_NOT_FOUND",
                    "The requested device does not exist.")));
        }

        if (!result.Acknowledged)
        {
            return new ConflictObjectResult(new ApiErrorResponse(
                new ApiError(
                    "DEVICE_NOT_ACKNOWLEDGEABLE",
                    "The device is not currently requesting assistance.",
                    result.OperationalStatus)));
        }

        return new OkObjectResult(new DeviceActionResponse(
            deviceId,
            result.OperationalStatus));
    }
}
