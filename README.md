# 🚀 AssetVerse Backend API

**AssetVerse** is a comprehensive Asset Management System backend built with Express.js, Firebase Authentication, MongoDB, and Stripe payment integration. This backend handles HR and employee workflows, asset tracking, request management, and payment processing.

---

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Environment Variables](#-environment-variables)
- [Database Setup](#-database-setup)
- [Running the Server](#-running-the-server)
- [API Endpoints](#-api-endpoints)
- [Deployment](#-deployment)
- [Project Structure](#-project-structure)
- [Security Features](#-security-features)
- [Contributing](#-contributing)
- [License](#-license)

---

## ✨ Features

### 👔 HR Features
- **Asset Management**: Add, update, delete, and track company assets
- **Employee Management**: Add employees, remove employees, view employee list
- **Request Handling**: Approve/reject asset requests from employees
- **Direct Asset Assignment**: Assign assets directly to employees without requests
- **Analytics Dashboard**: View asset distribution and request statistics
- **Payment Integration**: Upgrade company packages via Stripe
- **Payment History**: Track all package upgrade transactions

### 👨‍💼 Employee Features
- **Asset Requests**: Request available assets from the company
- **My Assets**: View assigned assets with search and filter
- **Asset Returns**: Return assets back to the company
- **Company Affiliation**: View affiliated companies
- **Team Management**: View team members in the same company
- **Profile Management**: Update personal profile information

### 🔒 Security & Performance
- **Firebase Authentication**: Secure token-based authentication
- **Role-Based Access Control**: HR and Employee role verification
- **MongoDB Indexing**: Optimized database queries

---

## 🛠 Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB (MongoDB Atlas)
- **Authentication**: Firebase Admin SDK
- **Payment**: Stripe API


---

## 📦 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v14 or higher) - [Download](https://nodejs.org/)
- **npm** or **yarn** - Comes with Node.js
- **MongoDB Atlas Account** - [Sign Up](https://www.mongodb.com/cloud/atlas)
- **Firebase Project** - [Firebase Console](https://console.firebase.google.com/)
- **Stripe Account** - [Sign Up](https://stripe.com/)

---

## 🔧 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/assetverse-backend.git
cd assetverse-backend
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Required NPM Packages

The following packages are required:

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "firebase-admin": "^11.10.1",
    "stripe": "^12.18.0",
    "mongodb": "^5.7.0",
    "express-rate-limit": "^6.10.0"
  }
}
```

Install all dependencies at once:

```bash
npm install express cors dotenv firebase-admin stripe mongodb
```

---

## 🔐 Environment Variables

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# MongoDB Configuration
DB_USERNAME=your_mongodb_username
DB_PASSWORD=your_mongodb_password

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key

# Optional: Frontend URLs (already configured in CORS)
FRONTEND_URL_LOCAL=http://localhost:5173
FRONTEND_URL_PRODUCTION=https://your-frontend.vercel.app
```

### Important Notes:
- Replace `your_mongodb_username` and `your_mongodb_password` with your MongoDB Atlas credentials
- Get your Stripe Secret Key from [Stripe Dashboard](https://dashboard.stripe.com/apikeys)
- Never commit `.env` file to version control

---

## 🔥 Firebase Setup

### 1. Create Firebase Service Account

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Project Settings** > **Service Accounts**
4. Click **Generate New Private Key**
5. Download the JSON file

### 2. Add Firebase Credentials

Rename the downloaded file to `assetverse.json` and place it in the root directory:

```
assetverse-backend/
├── assetverse.json  ← Place your Firebase service account here
├── .env
├── index.js
└── package.json
```

**⚠️ Security Warning**: Add `assetverse.json` to `.gitignore`:

```bash
echo "assetverse.json" >> .gitignore
```

---

## 🗄️ Database Setup

### MongoDB Collections

The following collections will be automatically created:

1. **users** - User accounts (HR & Employees)
2. **AssetverseALLDBStarting** - Assets inventory
3. **requests** - Asset requests from employees
4. **assignedAssets** - Currently assigned assets
5. **employeeAffiliations** - Employee-company relationships
6. **packages** - Subscription packages
7. **payments** - Payment transaction history

### Database Indexes

Indexes are automatically created on startup for optimal performance:

```javascript
// Indexes created automatically
users: { email: 1, firebaseUid: 1 }
assets: { hrEmail: 1 }
requests: { requesterEmail: 1, hrEmail: 1 }
```

---

## 🚀 Running the Server

### Development Mode

```bash
npm start
```

or with nodemon for auto-restart:

```bash
npm install -g nodemon
nodemon index.js
```

### Production Mode

```bash
NODE_ENV=production npm start
```

The server will start on `http://localhost:5000`

### Health Check

Verify the server is running:

```bash
curl http://localhost:5000/health
```

Expected response:
```json
{
  "status": "healthy",
  "mongodb": "connected",
  "firebase": "initialized",
  "message": "AssetVerse Backend is running! 🚀",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": "125 seconds",
  "memory": "45 MB",
  "collections": {
    "users": "ready",
    "assets": "ready",
    "requests": "ready"
  }
}
```

---

## 📡 API Endpoints

### 🔐 Authentication Routes

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "firebaseUid": "firebase_user_id",
  "name": "John Doe",
  "email": "john@example.com",
  "role": "employee", // or "hr"
  "dateOfBirth": "1990-01-01",
  "photo": "https://example.com/photo.jpg",
  "companyName": "Tech Corp", // Required if role is "hr"
  "companyLogo": "https://example.com/logo.jpg" // Optional for HR
}
```

#### Login User
```http
POST /api/auth/login
Authorization: Bearer YOUR_FIREBASE_TOKEN
```

#### Get Current User
```http
GET /api/auth/me
Authorization: Bearer YOUR_FIREBASE_TOKEN
```

---

### 👔 HR Routes

All HR routes require `Authorization: Bearer YOUR_FIREBASE_TOKEN` header.

#### Get All Assets (Paginated)
```http
GET /api/hr/assets?page=1&limit=10&search=laptop
```

#### Add New Asset
```http
POST /api/hr/assets
Content-Type: application/json

{
  "productName": "MacBook Pro",
  "productImage": "https://example.com/macbook.jpg",
  "productType": "Returnable", // or "Non-returnable"
  "productQuantity": 10
}
```

#### Update Asset
```http
PUT /api/hr/assets/:id
Content-Type: application/json

{
  "productName": "MacBook Pro 16",
  "productImage": "https://example.com/macbook.jpg",
  "productType": "Returnable",
  "productQuantity": 15
}
```

#### Delete Asset
```http
DELETE /api/hr/assets/:id
```

#### Get All Requests
```http
GET /api/hr/requests?status=pending
```

#### Approve Request
```http
POST /api/hr/requests/:id/approve
```

#### Reject Request
```http
POST /api/hr/requests/:id/reject
Content-Type: application/json

{
  "reason": "Asset not available"
}
```

#### Get All Employees
```http
GET /api/hr/employees
```

#### Remove Employee
```http
DELETE /api/hr/employees/:email
```

#### Get Available Employees (Not in any company)
```http
GET /api/hr/available-employees
```

#### Assign Employee to Company
```http
POST /api/hr/employees/assign
Content-Type: application/json

{
  "employeeEmail": "employee@example.com",
  "employeeName": "Jane Smith"
}
```

#### Assign Asset Directly to Employee
```http
POST /api/hr/assign-asset-directly
Content-Type: application/json

{
  "employeeEmail": "employee@example.com",
  "assetId": "64f8b2c3e4b0c1a2b3c4d5e6",
  "note": "Urgent assignment for project"
}
```

#### Get Analytics
```http
GET /api/hr/analytics
```

Response:
```json
{
  "assetTypes": [
    { "_id": "Returnable", "count": 45 },
    { "_id": "Non-returnable", "count": 23 }
  ],
  "topRequested": [
    { "_id": "MacBook Pro", "count": 12 },
    { "_id": "iPhone 15", "count": 8 }
  ],
  "stats": {
    "totalAssets": 68,
    "totalRequests": 145,
    "pendingRequests": 12,
    "approvedRequests": 120
  }
}
```

---

### 👨‍💼 Employee Routes

#### Get My Assets
```http
GET /api/employee/my-assets?search=laptop&type=Returnable
Authorization: Bearer YOUR_FIREBASE_TOKEN
```

#### Get Available Assets
```http
GET /api/employee/available-assets
Authorization: Bearer YOUR_FIREBASE_TOKEN
```

#### Request Asset
```http
POST /api/employee/request-asset
Authorization: Bearer YOUR_FIREBASE_TOKEN
Content-Type: application/json

{
  "assetId": "64f8b2c3e4b0c1a2b3c4d5e6",
  "note": "Need for project work"
}
```

#### Return Asset
```http
POST /api/employee/return-asset/:id
Authorization: Bearer YOUR_FIREBASE_TOKEN
```

#### Get My Companies
```http
GET /api/employee/my-companies
Authorization: Bearer YOUR_FIREBASE_TOKEN
```

#### Get Team Members
```http
GET /api/employee/team/:companyId
Authorization: Bearer YOUR_FIREBASE_TOKEN
```

---

### 👤 Profile Routes

#### Get Profile
```http
GET /api/profile
Authorization: Bearer YOUR_FIREBASE_TOKEN
```

#### Update Profile
```http
PUT /api/profile
Authorization: Bearer YOUR_FIREBASE_TOKEN
Content-Type: application/json

{
  "name": "John Doe",
  "dateOfBirth": "1990-01-01",
  "phone": "+1234567890",
  "photo": "https://example.com/photo.jpg",
  "address": "123 Main St, City",
  "bio": "Software Developer"
}
```

---

### 💳 Payment Routes (HR Only)

#### Get Packages
```http
GET /api/packages
```

#### Create Payment Intent
```http
POST /api/payment/create-intent
Authorization: Bearer YOUR_FIREBASE_TOKEN
Content-Type: application/json

{
  "packageName": "Standard",
  "amount": 19.99,
  "employeeLimit": 20
}
```

#### Confirm Payment
```http
POST /api/payment/confirm
Authorization: Bearer YOUR_FIREBASE_TOKEN
Content-Type: application/json

{
  "paymentIntentId": "pi_1234567890",
  "packageName": "Standard",
  "employeeLimit": 20,
  "amount": 19.99
}
```

#### Get Payment History
```http
GET /api/payment/history
Authorization: Bearer YOUR_FIREBASE_TOKEN
```

---

## 🌐 CORS Configuration

The server accepts requests from:

```javascript
const corsOptions = {
  origin: [
    "http://localhost:5000",  // Local Next.js
    "http://localhost:5173",  // Local Vite
    "https://assetverse-assest-management-web-se.vercel.app",  // Backend
    "https://assetverse-asset-management-web-cli.vercel.app"   // Frontend
  ],
  credentials: true
};
```

To add more origins, update the `corsOptions` array in `index.js`.

---

## 🚢 Deployment

### Deploy to Vercel

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Create `vercel.json`:
```json
{
  "version": 2,
  "builds": [
    {
      "src": "index.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "index.js"
    }
  ]
}
```

3. Deploy:
```bash
vercel
```

4. Add environment variables in Vercel Dashboard:
   - Go to Project Settings > Environment Variables
   - Add all variables from `.env`
   - Add `assetverse.json` content as `FIREBASE_SERVICE_ACCOUNT` (stringify the JSON)

### Deploy to Railway

1. Create account at [Railway.app](https://railway.app/)
2. Connect your GitHub repository
3. Add environment variables
4. Deploy automatically

### Deploy to Render

1. Create account at [Render.com](https://render.com/)
2. Create new Web Service
3. Connect repository
4. Add environment variables
5. Deploy

---

## 📁 Project Structure

```
assetverse-backend/
├── index.js                 # Main application file
├── assetverse.json          # Firebase service account (gitignored)
├── .env                     # Environment variables (gitignored)
├── .gitignore              # Git ignore file
├── package.json            # Dependencies and scripts
├── README.md               # This file
└── vercel.json             # Vercel deployment config (optional)
```

---

## 🔒 Security Features

### Rate Limiting

```javascript
// General routes: 100 requests per 15 minutes
// Auth routes: 5 requests per 15 minutes (login/register)
```

---

## 🐛 Troubleshooting

### MongoDB Connection Issues

```bash
# Error: MongoNetworkError
# Solution: Check if MongoDB Atlas IP whitelist includes your IP
# Go to MongoDB Atlas > Network Access > Add IP Address > Allow Access from Anywhere (0.0.0.0/0)
```

### Firebase Authentication Errors

```bash
# Error: auth/id-token-expired
# Solution: Token has expired, re-authenticate on frontend

# Error: auth/argument-error
# Solution: Invalid token format, check Bearer token in headers
```

### Stripe Payment Issues

```bash
# Error: Invalid API Key
# Solution: Verify STRIPE_SECRET_KEY starts with 'sk_test_' or 'sk_live_'

# Error: Payment Intent not found
# Solution: Verify payment intent ID is correct and not expired
```

### CORS Errors

```bash
# Error: CORS policy blocked
# Solution: Add your frontend URL to corsOptions in index.js
```

---

## 📊 Performance Optimization

The backend includes several optimizations:

1. **Database Indexing**: Automatic indexes on frequently queried fields
2. **Compression**: Gzip compression for all responses
3. **Connection Pooling**: MongoDB connection reuse
4. **Rate Limiting**: Prevents server overload
5. **Graceful Shutdown**: Proper cleanup on server stop

---

## 🧪 Testing

### Test Health Endpoint

```bash
curl http://localhost:5000/health
```

### Test Authentication

```bash
# Register
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"firebaseUid":"test123","name":"Test User","email":"test@example.com","role":"employee","dateOfBirth":"1990-01-01"}'

# Login (with Firebase token)
curl -X POST http://localhost:5000/api/auth/login \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN"
```

---

## 📝 API Response Format

### Success Response
```json
{
  "message": "Operation successful",
  "data": { ... }
}
```

### Error Response
```json
{
  "message": "Error description",
  "error": "Detailed error message"
}
```

### HTTP Status Codes
- `200` - OK
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error
- `503` - Service Unavailable

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Code Style

- Use ES6+ syntax
- Follow consistent naming conventions
- Add comments for complex logic
- Handle errors gracefully
- Write meaningful commit messages

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👥 Authors

- **Your Name** - *Initial work* - [YourGitHub](https://github.com/yourusername)

---

## 🙏 Acknowledgments

- Express.js team for the amazing framework
- Firebase team for authentication services
- MongoDB team for the database
- Stripe team for payment processing
- Open source community for the excellent packages

---

## 📞 Support

For support, email support@assetverse.com or open an issue in the GitHub repository.

---

## 🔗 Links

- **Frontend Repository**: [AssetVerse Frontend](https://github.com/Yeasinoncode98/assetverse-asset-management-web-client.git)
- **Live Demo**: [AssetVerse Demo](https://assetverse-asset-management-web-cli.vercel.app/)
<!-- - **Documentation**: [Full API Docs](https://docs.assetverse.com) -->

---

## 📈 Roadmap

- [ ] Add WebSocket support for real-time notifications
- [ ] Implement email notifications
- [ ] Add file upload for asset images
- [ ] Create admin dashboard
- [ ] Add multi-language support
- [ ] Implement audit logs
- [ ] Add export functionality (CSV/PDF)
- [ ] Create mobile app support

---

**Made with ❤️ by the AssetVerse Team**

**Made with ❤️ by Yeasin Arafat**
