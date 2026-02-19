# Azure Storage Setup Guide

This guide explains how to set up Azure Blob Storage and Azure Cache for Redis for the Social Media Stack.

## Azure Blob Storage (for images)

### Create a Storage Account

1. Sign in to the [Azure Portal](https://portal.azure.com)
2. Click **Create a resource** → **Storage** → **Storage account**
3. Configure the storage account:
   - **Subscription**: Select your subscription
   - **Resource group**: Create new or use existing
   - **Storage account name**: Choose a unique name (e.g., `socialmediastorage`)
   - **Region**: Choose a region close to your users
   - **Performance**: Standard
   - **Redundancy**: LRS (Locally redundant storage) for development
4. Click **Review + create** → **Create**

### Create a Blob Container

1. Navigate to your storage account
2. Go to **Containers** under **Data storage**
3. Click **+ Container**
4. Name: `social-media-images`
5. Public access level: **Blob** (public read access for blobs)
6. Click **Create**

### Get Connection String

1. In your storage account, go to **Access keys** under **Security + networking**
2. Click **Show keys**
3. Copy **Connection string** from key1 or key2

### Configure CORS (Required for mobile uploads)

1. In your storage account, go to **Resource sharing (CORS)** under **Settings**
2. Add a new CORS rule for **Blob service**:
   - **Allowed origins**: `*` (or specific domains for production)
   - **Allowed methods**: GET, POST, PUT, DELETE, OPTIONS
   - **Allowed headers**: `*`
   - **Exposed headers**: `*`
   - **Max age**: 3600
3. Click **Save**

## Azure Cache for Redis (for messaging)

### Create Azure Cache for Redis

1. In the Azure Portal, click **Create a resource** → **Databases** → **Azure Cache for Redis**
2. Configure the cache:
   - **Subscription**: Select your subscription
   - **Resource group**: Same as storage account
   - **DNS name**: Choose a unique name (e.g., `socialmedia-redis`)
   - **Location**: Same region as storage account
   - **Cache type**: Basic C0 (250 MB) for development
   - **Clustering**: Disabled (for Basic tier)
3. On the **Advanced** tab:
   - **Non-TLS port**: Disabled (keep TLS enabled)
   - **Minimum TLS version**: 1.2
4. Click **Review + create** → **Create** (this may take 10-15 minutes)

### Get Redis Connection String

1. Navigate to your Redis cache
2. Go to **Access keys** under **Settings**
3. Copy the **Primary connection string**
4. The format will be: `your-redis-name.redis.cache.windows.net:6380,password=your-password,ssl=True,abortConnect=False`

## Update Environment Variables

Add these to your `backend/.env` file:

```bash
# Azure Storage
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=socialmediastorage;AccountKey=your-actual-key-here;EndpointSuffix=core.windows.net
AZURE_STORAGE_CONTAINER_NAME=social-media-images

# Azure Redis
AZURE_REDIS_CONNECTION_STRING=socialmedia-redis.redis.cache.windows.net:6380,password=your-actual-password-here,ssl=True,abortConnect=False
```

## Testing

### Test Storage

1. Start your backend: `cd backend && npm run dev`
2. Try uploading a profile image through the `/api/v1/uploads/profile-image` endpoint
3. You should see the image in your Azure Storage container

### Test Redis

1. With the backend running, check the logs for "Azure Redis clients connected successfully"
2. Try sending a message in the app
3. Real-time delivery should work through Redis pub/sub

## Production Considerations

- **Storage**: Upgrade to GRS (Geo-redundant storage) for production
- **Redis**: Upgrade to Standard tier for better performance and SLA
- **Security**: Use Azure Key Vault to store connection strings
- **CORS**: Restrict allowed origins to your specific domains
- **Networking**: Consider using private endpoints for enhanced security

## Additional Resources

- [Azure Storage Documentation](https://docs.microsoft.com/en-us/azure/storage/)
- [Azure Cache for Redis Documentation](https://docs.microsoft.com/en-us/azure/azure-cache-for-redis/)
- [Azure Blob Storage with Node.js](https://docs.microsoft.com/en-us/azure/storage/blobs/storage-quickstart-blobs-nodejs)
