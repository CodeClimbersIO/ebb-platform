# Deployment Guide

This guide explains how to deploy the Ebb Platform Server using Docker and Docker Compose with Supabase as the database. The project includes automated CI/CD pipelines similar to the [CodeClimbers Platform Service](https://github.com/CodeClimbersIO/platform-server) for streamlined deployment.

## Deployment Options

### 1. Automated Deployment (Recommended)
The project includes GitHub Actions workflows for automated building and deployment:

- **CI/CD Pipeline**: Automatically builds, tests, and publishes Docker images
- **Automated Deployment**: Deploys to staging/production on push to main/develop branches
- **Manual Deployment**: Trigger deployments manually through GitHub Actions

### 2. Manual Deployment
Deploy directly to your server using Docker Compose.

## Prerequisites

- Docker and Docker Compose installed on your server
- A Supabase project set up with database and authentication
- (For automated deployment) GitHub repository with secrets configured

## Automated Deployment Setup

### 1. Configure GitHub Secrets

In your GitHub repository, go to **Settings > Secrets and Variables > Actions** and add:

**For Staging:**
- `STAGING_HOST`: Your staging server IP/hostname
- `STAGING_USER`: SSH username for staging server
- `STAGING_SSH_KEY`: Private SSH key for staging server access

**For Production:**
- `PRODUCTION_HOST`: Your production server IP/hostname  
- `PRODUCTION_USER`: SSH username for production server
- `PRODUCTION_SSH_KEY`: Private SSH key for production server access

### 2. Server Setup

On your server, ensure:
1. Docker and Docker Compose are installed
2. The SSH user has Docker permissions: `sudo usermod -aG docker $USER`
3. `curl` is installed for health checks

### 3. Environment Configuration

Create a `.env` file in your deployment directory on the server:

```bash
# Supabase Configuration (Required)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here

# Application Configuration
PORT=3001
```

### 4. Deployment Triggers

**Automatic Deployment:**
- Push to `main` branch → Deploys to production
- Push to `develop` branch → Deploys to staging

**Manual Deployment:**
1. Go to **Actions** tab in GitHub
2. Select **Deploy to Server** workflow
3. Click **Run workflow**
4. Choose environment and options

## Manual Deployment

### Quick Start

1. **Clone or download the deployment files:**
   ```bash
   curl -O https://raw.githubusercontent.com/your-org/ebb-platform/main/docker-compose.yaml
   curl -O https://raw.githubusercontent.com/your-org/ebb-platform/main/env.example
   ```

2. **Create environment file:**
   ```bash
   cp env.example .env
   ```

3. **Configure environment variables** in `.env`:
   ```bash
   # Supabase Configuration (Required)
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key-here
   
   # Application Configuration
   PORT=3001
   
   # GitHub Container Registry image (optional override)
   GITHUB_REPOSITORY=your-org/ebb-platform
   IMAGE_TAG=latest
   ```

4. **Deploy with Docker Compose:**
   ```bash
   docker-compose up -d
   ```

## Local Development

For local development, use the development compose file:

```bash
# Build and run locally
docker-compose -f docker-compose.dev.yaml up -d

# Or for live development
bun install
bun run dev
```

## Environment Variables

### Required
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Your Supabase anonymous key

### Optional
- `PORT`: Application port (defaults to 3001)
- `GITHUB_REPOSITORY`: GitHub repository name (for image pulling)
- `IMAGE_TAG`: Docker image tag to use (defaults to latest)

## Docker Images

The CI/CD pipeline automatically builds and publishes Docker images to GitHub Container Registry:

- **Registry**: `ghcr.io/your-org/ebb-platform`
- **Tags**: 
  - `latest` - Latest main branch build
  - `main-<sha>` - Specific commit builds
  - `v1.0.0` - Release tags

## Finding Supabase Database Credentials

1. Go to your Supabase project dashboard
2. Navigate to **Settings** > **Database**
3. Under **Connection info**, you'll find:
   - **Host**: Use this for `DB_HOST`
   - **Database**: Use this for `DB_NAME` (usually `postgres`)
   - **User**: Use this for `DB_USER` (usually `postgres`)
   - **Port**: Use this for `DB_PORT` (usually `5432`)
   - **Password**: Use the password you set when creating the project for `DB_PASSWORD`

## Management Commands

### Start services
```bash
docker-compose up -d
```

### Stop services
```bash
docker-compose down
```

### View logs
```bash
docker-compose logs -f app
```

### Update to latest image
```bash
docker-compose pull
docker-compose up -d
```

### Use specific image version
```bash
IMAGE_TAG=v1.0.0 docker-compose up -d
```

## Health Checks

- **Application**: `http://your-server:3001/health`
- **Database**: Managed by Supabase

## Security Considerations

1. **Secure credentials**: Keep your Supabase credentials secure and don't commit them to version control
2. **SSH Keys**: Use dedicated SSH keys for deployment with minimal privileges
3. **Firewall**: Only expose necessary ports (3001 for the app)
4. **HTTPS**: Use a reverse proxy (nginx, Caddy) for SSL termination
5. **Container security**: Images are scanned for vulnerabilities in CI/CD
6. **Supabase security**: Configure Row Level Security (RLS) policies in your Supabase database
7. **Updates**: Images are automatically updated through CI/CD pipeline

## Monitoring and Logging

### Application Logs
```bash
# View real-time logs
docker-compose logs -f app

# View last 100 lines
docker-compose logs --tail=100 app
```

### Health Monitoring
The application includes a `/health` endpoint that returns:
```json
{
  "status": "OK",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "service": "CodeClimbers API"
}
```

## Reverse Proxy Setup (Optional)

For production, consider using a reverse proxy like nginx:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Troubleshooting

### Deployment Issues
1. Check GitHub Actions logs for build/deployment failures
2. Verify server SSH access: `ssh user@your-server`
3. Check Docker status on server: `docker ps`
4. Verify environment variables are set correctly

### App won't start
1. Check logs: `docker-compose logs app`
2. Verify all environment variables are set correctly
3. Test Supabase connection from your server
4. Check if the image was pulled correctly: `docker images`

### Database connection issues
1. Verify Supabase credentials in `.env`
2. Check if your server's IP is allowed in Supabase (if you have IP restrictions)
3. Test database connectivity: `curl -I https://your-project.supabase.co`

### Port conflicts
If port 3001 is already in use, change the PORT environment variable:
```bash
PORT=8080 docker-compose up -d
```

### Image pull issues
1. Verify the image exists: Check GitHub Container Registry
2. Make sure the repository name is correct in environment variables
3. Check if the image is public or if authentication is needed

## CI/CD Pipeline Details

The automated pipeline includes:

1. **Testing**: Runs Bun tests on every PR and push
2. **Building**: Creates multi-architecture Docker images (AMD64/ARM64)
3. **Security Scanning**: Scans images for vulnerabilities with Trivy
4. **Deployment**: Automatically deploys to staging/production
5. **Health Verification**: Confirms application health after deployment
6. **Cleanup**: Removes old Docker images to save space

## Supabase Setup Tips

1. **Enable connection pooling** in Supabase for better performance
2. **Set up database migrations** using Supabase CLI or manual SQL scripts
3. **Configure authentication** policies in Supabase dashboard
4. **Monitor usage** in the Supabase dashboard to stay within limits
5. **Backup strategy**: Supabase handles automated backups, but consider additional backup strategies for critical data 