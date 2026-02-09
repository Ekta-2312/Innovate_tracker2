# Deploying Donor Location Tracker to Vercel

## Prerequisites
- Git repository (GitHub, GitLab, or Bitbucket)
- Vercel account (sign up at https://vercel.com)

## Steps to Deploy via Git Repository:

### 1. Initialize Git Repository (if not already done)
```bash
git init
git add .
git commit -m "Initial commit"
```

### 2. Push to GitHub/GitLab/Bitbucket

**For GitHub:**
```bash
# Create a new repository on GitHub, then:
git remote add origin https://github.com/Ekta-2312/donor-tracker.git
git branch -M main
git push -u origin main
```

**For GitLab:**
```bash
git remote add origin https://gitlab.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main
```

**For Bitbucket:**
```bash
git remote add origin https://bitbucket.org/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main
```

### 3. Deploy to Vercel

#### Option A: Via Vercel Dashboard (Recommended)
1. Go to https://vercel.com/dashboard
2. Click "Add New" → "Project"
3. Import your Git repository
4. Vercel will auto-detect the settings
5. Click "Deploy"

#### Option B: Via Vercel CLI
```bash
# Install Vercel CLI globally
npm install -g vercel

# Login to Vercel
vercel login

# Deploy
vercel --prod
```

### 4. Environment Variables (if needed)
If you have environment variables (like MongoDB connection string), add them in:
- Vercel Dashboard → Your Project → Settings → Environment Variables

Example:
- `MONGODB_URI`: Your MongoDB connection string
- `NODE_ENV`: production

### 5. Update CORS Settings
After deployment, update the CORS settings in `server.ts` to include your Vercel domain.

## Project Structure
- **Root**: Express backend server
- **client/**: React frontend application
- **vercel.json**: Vercel configuration (routes, builds)

## Important Notes:
- The `vercel.json` file is already configured for this project
- Backend API routes are prefixed with `/api`
- Frontend build output is served from `client/build`
- MongoDB connection is required for the app to work

## Troubleshooting:
- **Build fails**: Check that all dependencies are in package.json
- **404 errors**: Verify routes in vercel.json
- **API not working**: Check environment variables and MongoDB connection
- **CORS errors**: Add your Vercel domain to CORS configuration in server.ts
