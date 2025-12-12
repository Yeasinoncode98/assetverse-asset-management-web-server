const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const admin = require("firebase-admin");
const stripe = require("stripe");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// Initialize dotenv
dotenv.config();

// Initialize Firebase Admin SDK
const serviceAccount = require("./assetverse.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Initialize Stripe with your secret key
const stripeClient = stripe(process.env.STRIPE_SECRET_KEY);

// Initialize app
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware - CORS Configuration
const corsOptions = {
  origin: [
    "http://localhost:5000", // Local Next.js development
    "http://localhost:5173", // Local Vite development
    "https://assetverse-assest-management-web-se.vercel.app", // Your backend URL
    // Add your frontend Vercel URL here when deployed:
    "https://assetverse-asset-management-web-cli.vercel.app",
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
  optionsSuccessStatus: 200,
};

// Middleware

app.use(cors(corsOptions));
app.use(express.json());
// Add this after app.use(express.json());
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);

  // Log if it's an auth-related request
  if (req.path.includes("/auth")) {
    console.log(`  📍 Auth endpoint hit: ${req.path}`);
    console.log(
      `  🔑 Has Authorization header: ${!!req.headers.authorization}`
    );
  }

  next();
});

// MongoDB Connection
const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.pkimykw.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Database Collections
let usersCollection;
let assetsCollection;
let requestsCollection;
let assignedAssetsCollection;
let affiliationsCollection;
let packagesCollection;
let paymentsCollection;

// ✅ ADD THIS LINE HERE:
let isMongoConnected = false;

//
async function connectDB() {
  try {
    console.log("⏳ Connecting to MongoDB...");
    await client.connect();
    console.log("✅ Connected to MongoDB!");

    const db = client.db("AssetverseDBFinal");
    usersCollection = db.collection("users");
    assetsCollection = db.collection("AssetverseALLDBStarting");
    requestsCollection = db.collection("requests");
    assignedAssetsCollection = db.collection("assignedAssets");
    affiliationsCollection = db.collection("employeeAffiliations");
    packagesCollection = db.collection("packages");
    paymentsCollection = db.collection("payments");

    console.log("📊 Creating database indexes...");

    // Create indexes for better performance
    await usersCollection.createIndex({ email: 1 }, { unique: true });
    await usersCollection.createIndex({ firebaseUid: 1 }, { unique: true });
    await assetsCollection.createIndex({ hrEmail: 1 });
    await requestsCollection.createIndex({ requesterEmail: 1, hrEmail: 1 });

    console.log("✅ Database indexes created");

    // SET TO TRUE HERE
    isMongoConnected = true;
    console.log("✅ MongoDB fully initialized and ready");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);

    // SET TO FALSE HERE
    isMongoConnected = false;

    // RETRY INSTEAD OF EXITING
    console.log("🔄 Retrying MongoDB connection in 5 seconds...");
    setTimeout(connectDB, 5000);
  }
}

connectDB();

// ✅ ADD: Middleware to check MongoDB connection
const checkMongoConnection = (req, res, next) => {
  if (!isMongoConnected) {
    console.warn("⚠️ Request received but MongoDB not connected");
    return res.status(503).send({
      message: "Database connection not ready. Please try again in a moment.",
    });
  }
  next();
};
//

// ✅ UPDATED: Better error handling
const verifyFirebaseToken = async (req, res, next) => {
  const authorization = req.headers.authorization;

  console.log("🔐 Verifying Firebase token...");

  if (!authorization || !authorization.startsWith("Bearer ")) {
    console.error("❌ No token provided");
    return res
      .status(401)
      .send({ message: "Unauthorized access - No token provided" });
  }

  const token = authorization.split("Bearer ")[1];

  if (!token) {
    console.error("❌ Empty token");
    return res
      .status(401)
      .send({ message: "Unauthorized access - Invalid token format" });
  }

  try {
    console.log("⏳ Validating token...");
    const decodedToken = await admin.auth().verifyIdToken(token);

    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified,
    };

    console.log("✅ Token verified for:", req.user.email);
    next();
  } catch (error) {
    console.error("❌ Token verification error:", error.message);

    // Provide specific error messages
    if (error.code === "auth/id-token-expired") {
      return res
        .status(401)
        .send({ message: "Token expired. Please login again." });
    } else if (error.code === "auth/argument-error") {
      return res.status(401).send({ message: "Invalid token format" });
    }

    return res.status(401).send({ message: "Invalid or expired token" });
  }
};

// Verify HR Role
const verifyHR = async (req, res, next) => {
  const email = req.user.email;
  const user = await usersCollection.findOne({ email });

  if (!user || user.role !== "hr") {
    return res.status(403).send({ message: "Forbidden: HR access only" });
  }

  req.hrUser = user;
  next();
};

// ==================== AUTH ROUTES ====================

app.post("/api/auth/register", checkMongoConnection, async (req, res) => {
  try {
    const userData = req.body;

    console.log("📝 Registration attempt for:", userData.email);

    // Check if user exists
    const existingUser = await usersCollection.findOne({
      email: userData.email,
    });

    if (existingUser) {
      console.warn("⚠️ User already exists:", userData.email);
      return res.status(400).send({ message: "User already exists" });
    }

    // Prepare user document
    const newUser = {
      firebaseUid: userData.firebaseUid,
      name: userData.name,
      email: userData.email,
      role: userData.role,
      dateOfBirth: new Date(userData.dateOfBirth),
      profileImage:
        userData.photo ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(
          userData.name
        )}&size=200`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Add HR-specific fields
    if (userData.role === "hr") {
      newUser.companyName = userData.companyName;
      newUser.companyLogo = userData.companyLogo || "";
      newUser.packageLimit = 5;
      newUser.currentEmployees = 0;
      newUser.subscription = "basic";
    }

    const result = await usersCollection.insertOne(newUser);

    console.log("✅ User registered successfully:", userData.email);

    res.status(201).send({
      message: "User registered successfully",
      user: { ...newUser, _id: result.insertedId },
    });
  } catch (error) {
    console.error("❌ Register error:", error);
    res
      .status(500)
      .send({ message: "Registration failed", error: error.message });
  }
});

// ........................

app.post(
  "/api/auth/login",
  checkMongoConnection,
  verifyFirebaseToken,
  async (req, res) => {
    try {
      const { email } = req.user;

      console.log("🔐 Login attempt for:", email);

      let user = await usersCollection.findOne({ email });

      if (!user) {
        console.error("❌ User not found in database:", email);
        return res
          .status(404)
          .send({ message: "User not found. Please register first." });
      }

      console.log("✅ User found:", user.name, user.role);

      // Update last login
      await usersCollection.updateOne(
        { email },
        { $set: { lastLogin: new Date() } }
      );

      res.send({
        message: "Login successful",
        user,
      });
    } catch (error) {
      console.error("❌ Login error:", error);
      res.status(500).send({ message: "Login failed", error: error.message });
    }
  }
);

// ...............................Checking the role as well as who is he HR or EMPLOYEE

app.get(
  "/api/auth/me",
  checkMongoConnection,
  verifyFirebaseToken,
  async (req, res) => {
    try {
      console.log("📡 Fetching user data for:", req.user.email);

      const user = await usersCollection.findOne({ email: req.user.email });

      if (!user) {
        console.error("❌ User not found in database:", req.user.email);
        return res.status(404).send({ message: "User not found" });
      }

      console.log("✅ User data retrieved:", user.name, user.role);
      res.send(user);
    } catch (error) {
      console.error("❌ Get user error:", error);
      res
        .status(500)
        .send({ message: "Failed to get user", error: error.message });
    }
  }
);

// ==================== HR ROUTES ====================

// Get All Assets (HR)
app.get("/api/hr/assets", verifyFirebaseToken, verifyHR, async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "" } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = { hrEmail: req.user.email };
    if (search) {
      query.productName = { $regex: search, $options: "i" };
    }

    const assets = await assetsCollection
      .find(query)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ dateAdded: -1 })
      .toArray();

    const total = await assetsCollection.countDocuments(query);

    res.send({
      assets,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
      total,
    });
  } catch (error) {
    res
      .status(500)
      .send({ message: "Failed to fetch assets", error: error.message });
  }
});

// Add Asset (HR)HR can add asset anyway he can also edit
app.post("/api/hr/assets", verifyFirebaseToken, verifyHR, async (req, res) => {
  try {
    const assetData = {
      productName: req.body.productName,
      productImage: req.body.productImage,
      productType: req.body.productType,
      productQuantity: parseInt(req.body.productQuantity),
      availableQuantity: parseInt(req.body.productQuantity),
      dateAdded: new Date(),
      hrEmail: req.user.email,
      companyName: req.hrUser.companyName,
    };

    const result = await assetsCollection.insertOne(assetData);
    res.status(201).send({
      message: "Asset added successfully",
      assetId: result.insertedId,
    });
  } catch (error) {
    res
      .status(500)
      .send({ message: "Failed to add asset", error: error.message });
  }
});

// .................................Put added here to change in the code from the frontend........................

app.put(
  "/api/hr/assets/:id",
  verifyFirebaseToken,
  verifyHR,
  async (req, res) => {
    try {
      const { id } = req.params;

      console.log("📝 Updating asset:", id);
      console.log("📦 Update data:", req.body);

      // Get current asset to calculate quantity difference
      const currentAsset = await assetsCollection.findOne({
        _id: new ObjectId(id),
        hrEmail: req.user.email,
      });

      if (!currentAsset) {
        return res.status(404).send({ message: "Asset not found" });
      }

      const oldQuantity = currentAsset.productQuantity;
      const newQuantity = parseInt(req.body.productQuantity);
      const quantityDifference = newQuantity - oldQuantity;

      // ✅ FIX: Update both productQuantity AND availableQuantity
      const updateData = {
        productName: req.body.productName,
        productImage: req.body.productImage,
        productType: req.body.productType,
        productQuantity: newQuantity,
        availableQuantity: currentAsset.availableQuantity + quantityDifference, // ✅ Adjust available
        updatedAt: new Date(),
      };

      console.log("🔄 Updating from:", oldQuantity, "to:", newQuantity);
      console.log(
        "📊 Available quantity:",
        currentAsset.availableQuantity,
        "→",
        updateData.availableQuantity
      );

      const result = await assetsCollection.updateOne(
        { _id: new ObjectId(id), hrEmail: req.user.email },
        { $set: updateData }
      );

      if (result.matchedCount === 0) {
        return res.status(404).send({ message: "Asset not found" });
      }

      console.log("✅ Asset updated successfully");

      res.send({
        message: "Asset updated successfully",
        updatedAsset: { _id: id, ...updateData },
      });
    } catch (error) {
      console.error("❌ Update asset error:", error);
      res.status(500).send({
        message: "Failed to update asset",
        error: error.message,
      });
    }
  }
);

// ...................................
// Delete Asset (HR)
app.delete(
  "/api/hr/assets/:id",
  verifyFirebaseToken,
  verifyHR,
  async (req, res) => {
    try {
      const { id } = req.params;
      const result = await assetsCollection.deleteOne({
        _id: new ObjectId(id),
        hrEmail: req.user.email,
      });

      if (result.deletedCount === 0) {
        return res.status(404).send({ message: "Asset not found" });
      }

      res.send({ message: "Asset deleted successfully" });
    } catch (error) {
      res
        .status(500)
        .send({ message: "Failed to delete asset", error: error.message });
    }
  }
);

// Get All Requests (HR) - ✅ WITH EMPLOYEE PHOTOS
app.get("/api/hr/requests", verifyFirebaseToken, verifyHR, async (req, res) => {
  try {
    const { status } = req.query;

    const query = { hrEmail: req.user.email };
    if (status && status !== "All") {
      query.requestStatus = status.toLowerCase();
    }

    const requests = await requestsCollection
      .find(query)
      .sort({ requestDate: -1 })
      .toArray();

    // ✅ Fetch employee photos for each request
    const requestsWithPhotos = await Promise.all(
      requests.map(async (request) => {
        const employee = await usersCollection.findOne({
          email: request.requesterEmail,
        });

        return {
          ...request,
          requesterPhoto:
            employee?.profileImage ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(
              request.requesterName
            )}&size=200`,
        };
      })
    );

    res.send(requestsWithPhotos);
  } catch (error) {
    res
      .status(500)
      .send({ message: "Failed to fetch requests", error: error.message });
  }
});

// Approve Request (HR)
app.post(
  "/api/hr/requests/:id/approve",
  verifyFirebaseToken,
  verifyHR,
  async (req, res) => {
    try {
      const { id } = req.params;
      const request = await requestsCollection.findOne({
        _id: new ObjectId(id),
      });

      if (!request) {
        return res.status(404).send({ message: "Request not found" });
      }

      // Check package limit
      if (req.hrUser.currentEmployees >= req.hrUser.packageLimit) {
        return res.status(400).send({
          message: "Employee limit reached. Please upgrade your package.",
        });
      }

      // Check asset availability
      const asset = await assetsCollection.findOne({
        _id: new ObjectId(request.assetId),
      });
      if (!asset || asset.availableQuantity < 1) {
        return res.status(400).send({ message: "Asset not available" });
      }

      // Check if first request from employee - create affiliation
      const existingAffiliation = await affiliationsCollection.findOne({
        employeeEmail: request.requesterEmail,
        hrEmail: req.user.email,
      });

      if (!existingAffiliation) {
        await affiliationsCollection.insertOne({
          employeeEmail: request.requesterEmail,
          employeeName: request.requesterName,
          hrEmail: req.user.email,
          companyName: req.hrUser.companyName,
          companyLogo: req.hrUser.companyLogo,
          affiliationDate: new Date(),
          status: "active",
        });

        // Increment employee count
        await usersCollection.updateOne(
          { email: req.user.email },
          { $inc: { currentEmployees: 1 } }
        );
      }

      // Update request status
      await requestsCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            requestStatus: "approved",
            approvalDate: new Date(),
            processedBy: req.user.email,
          },
        }
      );

      // Deduct asset quantity
      await assetsCollection.updateOne(
        { _id: new ObjectId(request.assetId) },
        { $inc: { availableQuantity: -1 } }
      );

      // Add to assigned assets
      await assignedAssetsCollection.insertOne({
        assetId: new ObjectId(request.assetId),
        assetName: request.assetName,
        assetImage: asset.productImage,
        assetType: request.assetType,
        employeeEmail: request.requesterEmail,
        employeeName: request.requesterName,
        hrEmail: req.user.email,
        companyName: req.hrUser.companyName,
        assignmentDate: new Date(),
        returnDate: null,
        status: "assigned",
      });

      res.send({ message: "Request approved successfully" });
    } catch (error) {
      console.error("Approve error:", error);
      res
        .status(500)
        .send({ message: "Failed to approve request", error: error.message });
    }
  }
);

// Reject Request (HR)
app.post(
  "/api/hr/requests/:id/reject",
  verifyFirebaseToken,
  verifyHR,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const result = await requestsCollection.updateOne(
        { _id: new ObjectId(id), hrEmail: req.user.email },
        {
          $set: {
            requestStatus: "rejected",
            processedBy: req.user.email,
            rejectionReason: reason || "",
          },
        }
      );

      if (result.matchedCount === 0) {
        return res.status(404).send({ message: "Request not found" });
      }

      res.send({ message: "Request rejected" });
    } catch (error) {
      res
        .status(500)
        .send({ message: "Failed to reject request", error: error.message });
    }
  }
);

// Get Employees (HR)
app.get(
  "/api/hr/employees",
  verifyFirebaseToken,
  verifyHR,
  async (req, res) => {
    try {
      const affiliations = await affiliationsCollection
        .find({ hrEmail: req.user.email, status: "active" })
        .toArray();

      const employeeEmails = affiliations.map((a) => a.employeeEmail);
      const employees = await usersCollection
        .find({ email: { $in: employeeEmails }, role: "employee" })
        .toArray();

      // Get asset count for each employee
      const employeesWithAssets = await Promise.all(
        employees.map(async (emp) => {
          const assetCount = await assignedAssetsCollection.countDocuments({
            employeeEmail: emp.email,
            hrEmail: req.user.email,
            status: "assigned",
          });

          const affiliation = affiliations.find(
            (a) => a.employeeEmail === emp.email
          );

          return {
            ...emp,
            assetsCount: assetCount,
            joinDate: affiliation.affiliationDate,
          };
        })
      );

      res.send({
        employees: employeesWithAssets,
        packageLimit: req.hrUser.packageLimit,
      });
    } catch (error) {
      res
        .status(500)
        .send({ message: "Failed to fetch employees", error: error.message });
    }
  }
);

// Remove Employee (HR)
app.delete(
  "/api/hr/employees/:email",
  verifyFirebaseToken,
  verifyHR,
  async (req, res) => {
    try {
      const { email } = req.params;

      // Remove affiliation
      await affiliationsCollection.updateOne(
        { employeeEmail: email, hrEmail: req.user.email },
        { $set: { status: "inactive" } }
      );

      // Return all assets
      await assignedAssetsCollection.updateMany(
        { employeeEmail: email, hrEmail: req.user.email, status: "assigned" },
        { $set: { status: "returned", returnDate: new Date() } }
      );

      // Decrement employee count
      await usersCollection.updateOne(
        { email: req.user.email },
        { $inc: { currentEmployees: -1 } }
      );

      res.send({ message: "Employee removed successfully" });
    } catch (error) {
      res
        .status(500)
        .send({ message: "Failed to remove employee", error: error.message });
    }
  }
);

// ==================== EMPLOYEE ROUTES ====================

// Get My Assets (Employee)
app.get("/api/employee/my-assets", verifyFirebaseToken, async (req, res) => {
  try {
    const { search = "", type = "All" } = req.query;

    const query = { employeeEmail: req.user.email, status: "assigned" };
    if (type !== "All") {
      query.assetType = type;
    }

    let assets = await assignedAssetsCollection
      .find(query)
      .sort({ assignmentDate: -1 })
      .toArray();

    // Filter by search
    if (search) {
      assets = assets.filter((a) =>
        a.assetName.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Get request details
    const assetsWithDetails = await Promise.all(
      assets.map(async (asset) => {
        const request = await requestsCollection.findOne({
          assetId: asset.assetId,
          requesterEmail: req.user.email,
          requestStatus: "approved",
        });

        return {
          ...asset,
          requestDate: request?.requestDate || asset.assignmentDate,
          approvalDate: request?.approvalDate || asset.assignmentDate,
        };
      })
    );

    res.send(assetsWithDetails);
  } catch (error) {
    res
      .status(500)
      .send({ message: "Failed to fetch assets", error: error.message });
  }
});

// Get Available Assets (Employee)
app.get(
  "/api/employee/available-assets",
  verifyFirebaseToken,
  async (req, res) => {
    try {
      const assets = await assetsCollection
        .find({ availableQuantity: { $gt: 0 } })
        .sort({ dateAdded: -1 })
        .toArray();

      res.send(assets);
    } catch (error) {
      res
        .status(500)
        .send({ message: "Failed to fetch assets", error: error.message });
    }
  }
);

// Request Asset (Employee) - ✅ Include photo
app.post(
  "/api/employee/request-asset",
  verifyFirebaseToken,
  async (req, res) => {
    try {
      const { assetId, note } = req.body;
      const asset = await assetsCollection.findOne({
        _id: new ObjectId(assetId),
      });

      if (!asset) {
        return res.status(404).send({ message: "Asset not found" });
      }

      if (asset.availableQuantity < 1) {
        return res.status(400).send({ message: "Asset not available" });
      }

      const user = await usersCollection.findOne({ email: req.user.email });

      const requestData = {
        assetId: new ObjectId(assetId),
        assetName: asset.productName,
        assetType: asset.productType,
        requesterName: user.name,
        requesterEmail: req.user.email,
        requesterPhoto:
          user.profileImage ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(
            user.name
          )}&size=200`, // ✅ Add photo with fallback
        hrEmail: asset.hrEmail,
        companyName: asset.companyName,
        requestDate: new Date(),
        approvalDate: null,
        requestStatus: "pending",
        note: note || "",
        processedBy: null,
      };

      await requestsCollection.insertOne(requestData);
      res.status(201).send({ message: "Asset request submitted successfully" });
    } catch (error) {
      res
        .status(500)
        .send({ message: "Failed to request asset", error: error.message });
    }
  }
);

// Return Asset (Employee)
app.post(
  "/api/employee/return-asset/:id",
  verifyFirebaseToken,
  async (req, res) => {
    try {
      const { id } = req.params;
      const asset = await assignedAssetsCollection.findOne({
        _id: new ObjectId(id),
        employeeEmail: req.user.email,
        status: "assigned",
      });

      if (!asset) {
        return res.status(404).send({ message: "Asset not found" });
      }

      // Update assigned asset
      await assignedAssetsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: "returned", returnDate: new Date() } }
      );

      // Increase available quantity
      await assetsCollection.updateOne(
        { _id: asset.assetId },
        { $inc: { availableQuantity: 1 } }
      );

      // Update request status
      await requestsCollection.updateOne(
        { assetId: asset.assetId, requesterEmail: req.user.email },
        { $set: { requestStatus: "returned" } }
      );

      res.send({ message: "Asset returned successfully" });
    } catch (error) {
      res
        .status(500)
        .send({ message: "Failed to return asset", error: error.message });
    }
  }
);

// Get My Companies (Employee)
app.get("/api/employee/my-companies", verifyFirebaseToken, async (req, res) => {
  try {
    const affiliations = await affiliationsCollection
      .find({ employeeEmail: req.user.email, status: "active" })
      .toArray();

    const companies = affiliations.map((a) => ({
      id: a._id,
      name: a.companyName,
      logo: a.companyLogo,
      joinDate: a.affiliationDate,
    }));

    res.send(companies);
  } catch (error) {
    res
      .status(500)
      .send({ message: "Failed to fetch companies", error: error.message });
  }
});

// Get Team Members (Employee)
app.get(
  "/api/employee/team/:companyId",
  verifyFirebaseToken,
  async (req, res) => {
    try {
      const { companyId } = req.params;

      // Get affiliation to find company details
      const myAffiliation = await affiliationsCollection.findOne({
        _id: new ObjectId(companyId),
      });

      if (!myAffiliation) {
        return res.status(404).send({ message: "Company not found" });
      }

      // Get all employees in this company
      const allAffiliations = await affiliationsCollection
        .find({
          hrEmail: myAffiliation.hrEmail,
          status: "active",
          employeeEmail: { $ne: req.user.email }, // Exclude current user
        })
        .toArray();

      const employeeEmails = allAffiliations.map((a) => a.employeeEmail);
      const teammates = await usersCollection
        .find({ email: { $in: employeeEmails }, role: "employee" })
        .toArray();

      const teammatesWithInfo = teammates.map((member) => ({
        id: member._id,
        name: member.name,
        email: member.email,
        photo: member.profileImage,
        position: "Employee",
        birthday: member.dateOfBirth,
      }));

      res.send(teammatesWithInfo);
    } catch (error) {
      res
        .status(500)
        .send({ message: "Failed to fetch team", error: error.message });
    }
  }
);

// ==================== PROFILE UPDATE ROUTE (Enhanced) ====================

app.put("/api/profile", verifyFirebaseToken, async (req, res) => {
  try {
    const { name, dateOfBirth, phone, photo, address, bio } = req.body;

    console.log("📝 Profile update request from:", req.user.email);

    // Build update object dynamically (only update provided fields)
    const updateData = {
      updatedAt: new Date(),
    };

    if (name) updateData.name = name.trim();
    if (dateOfBirth) updateData.dateOfBirth = new Date(dateOfBirth);
    if (phone !== undefined) updateData.phone = phone.trim();
    if (photo) updateData.profileImage = photo;
    if (address !== undefined) updateData.address = address.trim();
    if (bio !== undefined) updateData.bio = bio.trim();

    console.log("📊 Update data:", updateData);

    // Update user in database
    const result = await usersCollection.updateOne(
      { email: req.user.email },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).send({ message: "User not found" });
    }

    console.log("✅ Profile updated successfully for:", req.user.email);

    // Get updated user data
    const updatedUser = await usersCollection.findOne({
      email: req.user.email,
    });

    res.status(200).send({
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("❌ Profile update error:", error);
    res.status(500).send({
      message: "Failed to update profile",
      error: error.message,
    });
  }
});

// Optional: Get current user profile (if not already exists)
app.get("/api/profile", verifyFirebaseToken, async (req, res) => {
  try {
    const user = await usersCollection.findOne({ email: req.user.email });

    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }

    res.status(200).send(user);
  } catch (error) {
    console.error("❌ Get profile error:", error);
    res.status(500).send({
      message: "Failed to get profile",
      error: error.message,
    });
  }
});

// ==================== PACKAGE ROUTES ====================

// Get All Packages
app.get("/api/packages", async (req, res) => {
  try {
    const packages = await packagesCollection.find({}).toArray();
    res.send(packages);
  } catch (error) {
    res
      .status(500)
      .send({ message: "Failed to fetch packages", error: error.message });
  }
});

// ==================== STRIPE PAYMENT ROUTES ====================

// Create Payment Intent
app.post(
  "/api/payment/create-intent",
  verifyFirebaseToken,
  verifyHR,
  async (req, res) => {
    try {
      const { packageName, amount, employeeLimit } = req.body;

      const paymentIntent = await stripeClient.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: "usd",
        automatic_payment_methods: { enabled: true },
        metadata: {
          hrEmail: req.user.email,
          packageName,
          employeeLimit,
        },
      });

      res.send({ clientSecret: paymentIntent.client_secret });
    } catch (error) {
      console.error("Stripe error:", error);
      res.status(500).send({
        message: "Payment intent creation failed",
        error: error.message,
      });
    }
  }
);

// Confirm Payment
app.post(
  "/api/payment/confirm",
  verifyFirebaseToken,
  verifyHR,
  async (req, res) => {
    try {
      const { paymentIntentId, packageName, employeeLimit, amount } = req.body;

      // Verify payment with Stripe
      const paymentIntent = await stripeClient.paymentIntents.retrieve(
        paymentIntentId
      );

      if (paymentIntent.status !== "succeeded") {
        return res.status(400).send({ message: "Payment not completed" });
      }

      // Update user package
      await usersCollection.updateOne(
        { email: req.user.email },
        {
          $set: {
            packageLimit: employeeLimit,
            subscription: packageName.toLowerCase(),
          },
        }
      );

      // Save payment record
      await paymentsCollection.insertOne({
        hrEmail: req.user.email,
        packageName,
        employeeLimit,
        amount,
        transactionId: paymentIntentId,
        paymentDate: new Date(),
        status: "completed",
      });

      res.send({ message: "Package upgraded successfully" });
    } catch (error) {
      console.error("Payment confirmation error:", error);
      res
        .status(500)
        .send({ message: "Payment confirmation failed", error: error.message });
    }
  }
);

// Get Payment History
app.get(
  "/api/payment/history",
  verifyFirebaseToken,
  verifyHR,
  async (req, res) => {
    try {
      const payments = await paymentsCollection
        .find({ hrEmail: req.user.email })
        .sort({ paymentDate: -1 })
        .toArray();

      res.send(payments);
    } catch (error) {
      res.status(500).send({
        message: "Failed to fetch payment history",
        error: error.message,
      });
    }
  }
);

// ==================== AVAILABLE EMPLOYEES ROUTES ====================

app.get(
  "/api/hr/available-employees",
  verifyFirebaseToken,
  verifyHR,
  async (req, res) => {
    try {
      console.log("📥 Fetching available employees for HR:", req.user.email);

      // Get all employees from users collection
      const allEmployees = await usersCollection
        .find({ role: "employee" })
        .sort({ createdAt: -1 })
        .toArray();

      console.log("👥 Total employees in DB:", allEmployees.length);

      // Get ALL active affiliations (not just for this HR)
      const allAffiliations = await affiliationsCollection
        .find({ status: "active" })
        .toArray();

      console.log("🔗 Total active affiliations:", allAffiliations.length);

      // Create array of all affiliated employee emails
      const affiliatedEmails = allAffiliations.map((aff) => aff.employeeEmail);

      console.log("📧 Affiliated emails:", affiliatedEmails);

      // Filter employees who are NOT in any affiliation
      const availableEmployees = allEmployees.filter(
        (emp) => !affiliatedEmails.includes(emp.email)
      );

      console.log("✅ Available employees count:", availableEmployees.length);
      console.log(
        "📋 Available employees:",
        availableEmployees.map((e) => e.email)
      );

      res.status(200).send(availableEmployees);
    } catch (error) {
      console.error("❌ Available employees error:", error);
      res.status(500).send({
        message: "Failed to fetch available employees",
        error: error.message,
      });
    }
  }
);

// Assign Employee to Company (HR)
app.post(
  "/api/hr/employees/assign",
  verifyFirebaseToken,
  verifyHR,
  async (req, res) => {
    try {
      const { employeeEmail, employeeName } = req.body;

      console.log(
        "➕ Assigning employee:",
        employeeEmail,
        "to HR:",
        req.user.email
      );

      // Validate input
      if (!employeeEmail || !employeeName) {
        return res.status(400).send({
          message: "Employee email and name are required",
        });
      }

      // Check if employee exists
      const employee = await usersCollection.findOne({
        email: employeeEmail,
        role: "employee",
      });

      if (!employee) {
        return res.status(404).send({
          message: "Employee not found or invalid role",
        });
      }

      console.log("✅ Employee found:", employee.name);

      // Check if already affiliated with THIS HR
      const existingAffiliation = await affiliationsCollection.findOne({
        employeeEmail,
        hrEmail: req.user.email,
        status: "active",
      });

      if (existingAffiliation) {
        return res.status(400).send({
          message: "This employee is already part of your company",
        });
      }

      // Check if affiliated with ANY company
      const anyAffiliation = await affiliationsCollection.findOne({
        employeeEmail,
        status: "active",
      });

      if (anyAffiliation) {
        return res.status(400).send({
          message: `This employee is already affiliated with ${anyAffiliation.companyName}`,
        });
      }

      console.log("✅ No existing affiliation found");

      // Check package limit
      const hrUser = await usersCollection.findOne({ email: req.user.email });

      if (!hrUser) {
        return res.status(404).send({ message: "HR user not found" });
      }

      console.log(
        "📊 Current employees:",
        hrUser.currentEmployees,
        "/ Limit:",
        hrUser.packageLimit
      );

      if (hrUser.currentEmployees >= hrUser.packageLimit) {
        return res.status(400).send({
          message: `Employee limit reached (${hrUser.packageLimit}). Please upgrade your package.`,
        });
      }

      console.log("✅ Package limit OK");

      // Create affiliation
      const affiliationResult = await affiliationsCollection.insertOne({
        employeeEmail,
        employeeName: employee.name,
        hrEmail: req.user.email,
        companyName: hrUser.companyName,
        companyLogo: hrUser.companyLogo || "",
        affiliationDate: new Date(),
        status: "active",
      });

      console.log("✅ Affiliation created:", affiliationResult.insertedId);

      // Increment employee count
      await usersCollection.updateOne(
        { email: req.user.email },
        { $inc: { currentEmployees: 1 } }
      );

      console.log("✅ Employee count incremented");

      res.status(200).send({
        message: `${employee.name} has been added to your company successfully!`,
        employee: {
          name: employee.name,
          email: employee.email,
          profileImage: employee.profileImage,
        },
      });
    } catch (error) {
      console.error("❌ Assign employee error:", error);
      res.status(500).send({
        message: "Failed to assign employee",
        error: error.message,
      });
    }
  }
);

// ==================== DIRECT ASSET ASSIGNMENT (HR) ====================

app.post(
  "/api/hr/assign-asset-directly",
  verifyFirebaseToken,
  verifyHR,
  async (req, res) => {
    try {
      const { employeeEmail, assetId, note } = req.body;

      console.log("📦 Direct asset assignment by HR:", req.user.email);
      console.log("👤 To employee:", employeeEmail);
      console.log("🎁 Asset ID:", assetId);

      // Validate input
      if (!employeeEmail || !assetId) {
        return res.status(400).send({
          message: "Employee email and asset ID are required",
        });
      }

      // Check if employee exists and is affiliated with this HR
      const affiliation = await affiliationsCollection.findOne({
        employeeEmail,
        hrEmail: req.user.email,
        status: "active",
      });

      if (!affiliation) {
        return res.status(404).send({
          message: "Employee not found in your company",
        });
      }

      console.log("✅ Employee is part of company:", affiliation.companyName);

      // Get asset details
      const asset = await assetsCollection.findOne({
        _id: new ObjectId(assetId),
        hrEmail: req.user.email,
      });

      if (!asset) {
        return res.status(404).send({
          message: "Asset not found",
        });
      }

      console.log("✅ Asset found:", asset.productName);

      // Check asset availability
      if (asset.availableQuantity < 1) {
        return res.status(400).send({
          message: "Asset is not available (quantity: 0)",
        });
      }

      console.log("✅ Asset available, quantity:", asset.availableQuantity);

      // Check if employee already has this asset
      const existingAssignment = await assignedAssetsCollection.findOne({
        assetId: new ObjectId(assetId),
        employeeEmail,
        status: "assigned",
      });

      if (existingAssignment) {
        return res.status(400).send({
          message: "This employee already has this asset",
        });
      }

      // Create a request entry (for record keeping) we will work
      const requestResult = await requestsCollection.insertOne({
        assetId: new ObjectId(assetId),
        assetName: asset.productName,
        assetType: asset.productType,
        requesterName: affiliation.employeeName,
        requesterEmail: employeeEmail,
        hrEmail: req.user.email,
        companyName: affiliation.companyName,
        requestDate: new Date(),
        approvalDate: new Date(),
        requestStatus: "approved", // Auto-approved by HR
        note: note || "Directly assigned by HR",
        processedBy: req.user.email,
        assignmentType: "direct", // Mark as direct assignment
      });

      console.log("✅ Request record created:", requestResult.insertedId);

      // Deduct asset quantity
      await assetsCollection.updateOne(
        { _id: new ObjectId(assetId) },
        { $inc: { availableQuantity: -1 } }
      );

      console.log("✅ Asset quantity decremented");

      // Add to assigned assets
      const assignmentResult = await assignedAssetsCollection.insertOne({
        assetId: new ObjectId(assetId),
        assetName: asset.productName,
        assetImage: asset.productImage,
        assetType: asset.productType,
        employeeEmail,
        employeeName: affiliation.employeeName,
        hrEmail: req.user.email,
        companyName: affiliation.companyName,
        assignmentDate: new Date(),
        returnDate: null,
        status: "assigned",
        assignmentType: "direct",
        assignedBy: req.user.email,
      });

      console.log("✅ Asset assigned:", assignmentResult.insertedId);

      res.status(200).send({
        message: `${asset.productName} has been assigned to ${affiliation.employeeName} successfully!`,
        assignment: {
          assetName: asset.productName,
          employeeName: affiliation.employeeName,
          assignmentDate: new Date(),
        },
      });
    } catch (error) {
      console.error("❌ Direct asset assignment error:", error);
      res.status(500).send({
        message: "Failed to assign asset",
        error: error.message,
      });
    }
  }
);
// ...............................................Anaylytics......................
app.get(
  "/api/hr/analytics",
  checkMongoConnection,
  verifyFirebaseToken,
  verifyHR,
  async (req, res) => {
    try {
      console.log("📊 Fetching analytics for HR:", req.user.email);

      // 1. Asset type distribution (Returnable vs Non-returnable)
      const assetTypes = await assetsCollection
        .aggregate([
          { $match: { hrEmail: req.user.email } },
          {
            $group: {
              _id: "$productType",
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
        ])
        .toArray();

      console.log("📦 Asset types:", assetTypes);

      // 2. Top 5 most requested assets (approved requests only)
      const topRequested = await requestsCollection
        .aggregate([
          {
            $match: {
              hrEmail: req.user.email,
              requestStatus: "approved",
            },
          },
          {
            $group: {
              _id: "$assetName",
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
          { $limit: 5 },
        ])
        .toArray();

      console.log("🔝 Top requested:", topRequested);

      // 3. Additional stats
      const totalAssets = await assetsCollection.countDocuments({
        hrEmail: req.user.email,
      });

      const totalRequests = await requestsCollection.countDocuments({
        hrEmail: req.user.email,
      });

      const pendingRequests = await requestsCollection.countDocuments({
        hrEmail: req.user.email,
        requestStatus: "pending",
      });

      const approvedRequests = await requestsCollection.countDocuments({
        hrEmail: req.user.email,
        requestStatus: "approved",
      });

      console.log("✅ Analytics data prepared successfully");

      res.status(200).send({
        assetTypes,
        topRequested,
        stats: {
          totalAssets,
          totalRequests,
          pendingRequests,
          approvedRequests,
        },
      });
    } catch (error) {
      console.error("❌ Analytics error:", error);
      res.status(500).send({
        message: "Failed to fetch analytics",
        error: error.message,
      });
    }
  }
);

// ==================== ROOT ROUTE ====================

app.get("/", (req, res) => {
  res.send("✅ AssetVerse Backend Server with Firebase Auth is running!");
});

// ==================== HEALTH CHECK ENDPOINT ====================

app.get("/health", (req, res) => {
  const health = {
    status: isMongoConnected ? "healthy" : "degraded",
    mongodb: isMongoConnected ? "connected" : "disconnected",
    firebase: admin.apps.length > 0 ? "initialized" : "not initialized",
    message: "AssetVerse Backend is running! 🚀",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()) + " seconds",
    memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + " MB",
    collections: {
      users: isMongoConnected && usersCollection ? "ready" : "not ready",
      assets: isMongoConnected && assetsCollection ? "ready" : "not ready",
      requests: isMongoConnected && requestsCollection ? "ready" : "not ready",
    },
  };

  const statusCode = isMongoConnected ? 200 : 503;
  res.status(statusCode).json(health);
});

// ...............after all routes

// Global error handler
app.use((err, req, res, next) => {
  console.error("❌ Unhandled error:", err);

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV !== "production";

  res.status(err.status || 500).send({
    message: err.message || "Internal server error",
    ...(isDevelopment && { stack: err.stack }),
  });
});

// ==================== START SERVER (ONLY ONCE!) ====================

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(
    `🔗 MongoDB: ${isMongoConnected ? "✅ Connected" : "⏳ Connecting..."}`
  );
});

// ==================== GRACEFUL SHUTDOWN (ONLY ONCE!) ====================

process.on("SIGINT", async () => {
  console.log("⏹️  Shutting down gracefully...");
  isMongoConnected = false;

  try {
    await client.close();
    console.log("✅ MongoDB connection closed");
  } catch (error) {
    console.error("❌ Error closing MongoDB:", error);
  }

  process.exit(0);
});

// Export for Vercel serverless
module.exports = app;
