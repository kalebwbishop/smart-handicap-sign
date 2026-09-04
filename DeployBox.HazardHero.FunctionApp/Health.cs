using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Configuration;

namespace DeployBox.HazardHero.FunctionApp;

public class Health
{
    private readonly IConfiguration _configuration;

    public Health(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    [Function("Health")]
    public IActionResult Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "health")]
        HttpRequest request)
    {
        var iotHubConfigured = !string.IsNullOrWhiteSpace(
            _configuration["IOT_HUB_CONNECTION_STRING"]);

        var response = new HealthResponse(
            iotHubConfigured ? "healthy" : "degraded",
            iotHubConfigured);

        return iotHubConfigured
            ? new OkObjectResult(response)
            : new ObjectResult(response)
            {
                StatusCode = StatusCodes.Status503ServiceUnavailable
            };
    }
}
