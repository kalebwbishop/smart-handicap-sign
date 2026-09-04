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
    var fullConnectionString = configuration["POSTGRES_CONNECTION_STRING"];
    if (!string.IsNullOrWhiteSpace(fullConnectionString))
    {
        return NormalizePostgresConnectionString(fullConnectionString);
    }

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

static string NormalizePostgresConnectionString(string connectionString)
{
    if (!connectionString.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase) &&
        !connectionString.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
    {
        return connectionString;
    }

    var schemeSeparator = connectionString.IndexOf("://", StringComparison.Ordinal);
    var userInfoSeparator = connectionString.LastIndexOf('@');
    if (schemeSeparator < 0 ||
        userInfoSeparator <= schemeSeparator + 3 ||
        !Uri.TryCreate(
            connectionString[..(schemeSeparator + 3)] +
                connectionString[(userInfoSeparator + 1)..],
            UriKind.Absolute,
            out var uri) ||
        string.IsNullOrWhiteSpace(uri.Host) ||
        string.IsNullOrWhiteSpace(uri.AbsolutePath))
    {
        throw new InvalidOperationException(
            "POSTGRES_CONNECTION_STRING must be a valid PostgreSQL URI or Npgsql connection string.");
    }

    var userInfo = connectionString[
        (schemeSeparator + 3)..userInfoSeparator].Split(':', 2);
    if (userInfo.Length != 2 ||
        string.IsNullOrWhiteSpace(userInfo[0]) ||
        string.IsNullOrWhiteSpace(userInfo[1]))
    {
        throw new InvalidOperationException(
            "PostgreSQL URI must include a username and password.");
    }

    var builder = new NpgsqlConnectionStringBuilder
    {
        Host = uri.Host,
        Port = uri.IsDefaultPort ? 5432 : uri.Port,
        Database = uri.AbsolutePath.TrimStart('/'),
        Username = Uri.UnescapeDataString(userInfo[0]),
        Password = Uri.UnescapeDataString(userInfo[1])
    };

    foreach (var queryPart in uri.Query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
    {
        var keyValue = queryPart.Split('=', 2);
        if (keyValue.Length == 2 &&
            keyValue[0].Equals("sslmode", StringComparison.OrdinalIgnoreCase))
        {
            builder.SslMode = Enum.Parse<SslMode>(
                Uri.UnescapeDataString(keyValue[1]),
                ignoreCase: true);
        }
    }

    return builder.ConnectionString;
}
