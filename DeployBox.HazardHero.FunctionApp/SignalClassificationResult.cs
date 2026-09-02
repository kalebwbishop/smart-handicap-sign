using System.Text.Json;

namespace DeployBox.HazardHero.FunctionApp;

public sealed record SignalClassificationResult(
    string? SchemaVersion,
    string? MessageId,
    string? OccurredAt,
    string? DeviceId,
    Classification? Classification);

public sealed record Classification(string? Label, double? Confidence);

public static class SignalClassificationResultValidator
{
    private static readonly JsonSerializerOptions SerializerOptions = new()
    {
        PropertyNameCaseInsensitive = false
    };

    public static bool TryParse(string body, out SignalClassificationResult? result, out string error)
    {
        result = null;

        try
        {
            result = JsonSerializer.Deserialize<SignalClassificationResult>(body, SerializerOptions);
        }
        catch (JsonException)
        {
            error = "Message body is not valid JSON.";
            return false;
        }

        if (result is null)
        {
            error = "Message body must contain a JSON object.";
            return false;
        }

        if (!Guid.TryParse(result.MessageId, out _))
        {
            error = "messageId must be a valid UUID.";
            return false;
        }

        if (!DateTimeOffset.TryParse(
                result.OccurredAt,
                out var occurredAt) ||
            occurredAt.Offset != TimeSpan.Zero)
        {
            error = "occurredAt must be an ISO-8601 UTC timestamp.";
            return false;
        }

        if (string.IsNullOrWhiteSpace(result.DeviceId))
        {
            error = "deviceId must be a non-empty string.";
            return false;
        }

        if (result.Classification is null ||
            result.Classification.Label is not ("positive" or "negative"))
        {
            error = "classification.label must be 'positive' or 'negative'.";
            return false;
        }

        if (!result.Classification.Confidence.HasValue ||
            double.IsNaN(result.Classification.Confidence.Value) ||
            double.IsInfinity(result.Classification.Confidence.Value) ||
            result.Classification.Confidence is < 0 or > 1)
        {
            error = "classification.confidence must be a number from 0 to 1.";
            return false;
        }

        error = string.Empty;
        return true;
    }
}
