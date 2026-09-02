using Azure.Monitor.OpenTelemetry.Exporter;
using DeployBox.HazardHero.FunctionApp;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Builder;
using Microsoft.Extensions.Configuration;
using Microsoft.Azure.Functions.Worker.OpenTelemetry;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Npgsql;
using OpenTelemetry;

var builder = FunctionsApplication.CreateBuilder(args);

builder.ConfigureFunctionsWebApplication();

var postgresConnectionString = BuildPostgresConnectionString(builder.Configuration);

builder.Services.AddSingleton(
    NpgsqlDataSource.Create(postgresConnectionString));
builder.Services.AddSingleton<SignalClassificationResultRepository>();
builder.Services.AddSingleton<IDeviceTwinService, DeviceTwinService>();
builder.Services.AddHttpClient<IDeviceNotificationService, DeviceNotificationService>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(10);
});

if (!string.IsNullOrEmpty(Environment.GetEnvironmentVariable("APPLICATIONINSIGHTS_CONNECTION_STRING")))
{
    builder.Services.AddOpenTelemetry()
        .UseFunctionsWorkerDefaults()
        .UseAzureMonitorExporter();
}

builder.Build().Run();

static string BuildPostgresConnectionString(IConfiguration configuration)
{
    var settings = new[]
    {
        "postgres-db-host",
        "postgres-db-name",
        "postgres-db-user",
        "postgres-db-pass"
    };

    var missingSettings = settings
        .Where(setting => string.IsNullOrWhiteSpace(configuration[setting]))
        .ToArray();

    if (missingSettings.Length > 0)
    {
        throw new InvalidOperationException(
            $"Missing PostgreSQL settings: {string.Join(", ", missingSettings)}.");
    }

    var connectionString = new NpgsqlConnectionStringBuilder
    {
        Host = configuration["postgres-db-host"],
        Database = configuration["postgres-db-name"],
        Username = configuration["postgres-db-user"],
        Password = configuration["postgres-db-pass"],
        Port = 5432,
        Pooling = true
    };

    return connectionString.ConnectionString;
}
