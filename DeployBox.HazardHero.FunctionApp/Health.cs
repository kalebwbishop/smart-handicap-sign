using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;

namespace DeployBox.HazardHero.FunctionApp;

public class Health
{
    [Function("Health")]
    public IActionResult Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "health")]
        HttpRequest request)
    {
        return new OkObjectResult(new HealthResponse("healthy"));
    }
}
