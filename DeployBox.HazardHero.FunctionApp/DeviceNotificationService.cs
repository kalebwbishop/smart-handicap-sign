using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace DeployBox.HazardHero.FunctionApp;

public interface IDeviceNotificationService
{
    Task<DeviceNotificationResult> SendAsync(
        DeviceNotification notification,
        CancellationToken cancellationToken);
}

public sealed class DeviceNotificationService : IDeviceNotificationService
{
    private const string ExpoPushApiUrl = "https://exp.host/--/api/v2/push/send";
    private const int ExpoPushBatchSize = 100;

    private readonly HttpClient _httpClient;
    private readonly ILogger<DeviceNotificationService> _logger;
    private readonly IConfiguration _configuration;
    private readonly SignalClassificationResultRepository _repository;

    public DeviceNotificationService(
        HttpClient httpClient,
        ILogger<DeviceNotificationService> logger,
        IConfiguration configuration,
        SignalClassificationResultRepository repository)
    {
        _httpClient = httpClient;
        _logger = logger;
        _configuration = configuration;
        _repository = repository;
    }

    public async Task<DeviceNotificationResult> SendAsync(
        DeviceNotification notification,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        ArgumentNullException.ThrowIfNull(notification);

        if (string.IsNullOrWhiteSpace(notification.DeviceId))
        {
            throw new ArgumentException(
                "A device ID is required.",
                nameof(notification));
        }

        if (string.IsNullOrWhiteSpace(notification.Type))
        {
            throw new ArgumentException(
                "A notification type is required.",
                nameof(notification));
        }

        var tokens = await _repository.GetDevicePushTokensAsync(
            notification.DeviceId,
            cancellationToken);
        if (tokens.Count == 0)
        {
            _logger.LogInformation(
                "No enabled push tokens found for device {DeviceId}.",
                notification.DeviceId);

            return new DeviceNotificationResult(
                DeviceNotificationStatus.NoRecipients,
                "expo",
                0,
                0);
        }

        var data = notification.Data is null
            ? new Dictionary<string, string>()
            : new Dictionary<string, string>(notification.Data);
        data["target"] = "home";

        var messages = tokens
            .Select(token => new
            {
                to = token,
                sound = "default",
                title = notification.Title,
                body = notification.Body,
                data
            })
            .ToArray();

        var accessToken = _configuration["expo-push-access-token"];
        var deliveredCount = 0;
        foreach (var batch in messages.Chunk(ExpoPushBatchSize))
        {
            using var request = new HttpRequestMessage(
                HttpMethod.Post,
                ExpoPushApiUrl)
            {
                Content = JsonContent.Create(batch)
            };
            request.Headers.Accept.Add(
                new MediaTypeWithQualityHeaderValue("application/json"));
            if (!string.IsNullOrWhiteSpace(accessToken))
            {
                request.Headers.Authorization = new AuthenticationHeaderValue(
                    "Bearer",
                    accessToken);
            }

            using var response = await _httpClient.SendAsync(
                request,
                cancellationToken);
            response.EnsureSuccessStatusCode();

            await using var responseStream = await response.Content.ReadAsStreamAsync(
                cancellationToken);
            using var payload = await JsonDocument.ParseAsync(
                responseStream,
                cancellationToken: cancellationToken);

            if (!payload.RootElement.TryGetProperty("data", out var results) ||
                results.ValueKind != JsonValueKind.Array)
            {
                throw new InvalidOperationException(
                    "Expo returned a response without a data array.");
            }

            foreach (var result in results.EnumerateArray())
            {
                if (result.TryGetProperty("status", out var status) &&
                    status.GetString() == "ok")
                {
                    deliveredCount++;
                    continue;
                }

                var errorMessage = result.TryGetProperty("message", out var message)
                    ? message.GetString()
                    : "Unknown Expo delivery error.";
                _logger.LogWarning(
                    "Expo push delivery failed for device {DeviceId}: {Reason}",
                    notification.DeviceId,
                    errorMessage);
            }
        }

        return new DeviceNotificationResult(
            DeviceNotificationStatus.Sent,
            "expo",
            messages.Length,
            deliveredCount);
    }
}

public sealed record DeviceNotification(
    string DeviceId,
    string Type,
    string? Title = null,
    string? Body = null,
    IReadOnlyDictionary<string, string>? Data = null);

public sealed record DeviceNotificationResult(
    DeviceNotificationStatus Status,
    string? Provider,
    int AttemptedCount,
    int DeliveredCount);

public enum DeviceNotificationStatus
{
    NoRecipients,
    Sent
}
