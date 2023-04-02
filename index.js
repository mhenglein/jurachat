"use strict";
require("dotenv").config();

const express = require("express");
const multer = require("multer");
const path = require("path");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const chalk = require("chalk");
const flash = require("express-flash");
const { v4: uuidv4 } = require("uuid");
const compression = require("compression");
const cors = require("cors");
const errorhandler = require("errorhandler");
const passport = require("passport");

// Purchasing routes
// const purchaseController = require("./controllers/purchase");
// const userController = require("./controllers/user");

/**
 * API keys and Passport configuration.
 */
// const passportConfig = require("./config/passport");

/**
 * Connect to MongoDB.
 */
// const { connect } = require("./startup/db");
// (async () => {
//   await connect();
// })();

const app = express();

// Sentry
const Sentry = require("@sentry/node");
const Tracing = require("@sentry/tracing");

Sentry.init({
  dsn: "https://b4b9094da68a43b08b62345b3bd98819@o4504394414817280.ingest.sentry.io/4504394419798016",
  integrations: [
    // enable HTTP calls tracing
    new Sentry.Integrations.Http({ tracing: true }),
    // enable Express.js middleware tracing
    new Tracing.Integrations.Express({ app }),
  ],

  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: 0.1,
});

// RequestHandler creates a separate execution context using domains, so that every
// transaction/span/breadcrumb is attached to its own Hub instance
app.use(Sentry.Handlers.requestHandler());
// TracingHandler creates a trace for every incoming request
app.use(Sentry.Handlers.tracingHandler());

/**
 * Express configuration.
 */
app.set("host", process.env.OPENSHIFT_NODEJS_IP || "0.0.0.0");
app.set("port", process.env.PORT || process.env.OPENSHIFT_NODEJS_PORT || 3000);
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

// Middleware via https://codingpr.com/stripe-webhook/
// Configure a middleware to separate webhook events from other post requests that your app may have.
// This is because webhooks can't be parsed as JSON objects.
app.use((req, res, next) => {
  try {
    express.json({
      limit: "50mb",
    })(req, res, next);
  } catch (err) {
    console.error(err);
    // you can add a log of the error
    console.log("Error while parsing JSON: ", err);
    // continue the execution of the application
    next();
  }
});

// app.use(
//   session({
//     resave: false, // don't save session if unmodified
//     saveUninitialized: false, // don't create session until something stored
//     secret: process.env.SESSION_SECRET,
//     genid: () => {
//       return uuidv4();
//     },
//     cookie: { maxAge: 1000 * 60 * 60 * 24 * 14 }, // 2 weeks
//     store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
//   })
// );

// app.use(passport.initialize());
// app.use(passport.session());

// Custom flash middleware -- from Ethan Brown's book, 'Web Development with Node & Express'
// app.use(flash());
// app.use(function (req, res, next) {
//   // if there's a flash message in the session request, make it available in the response, then delete it
//   res.locals.sessionFlash = req.session.sessionFlash;
//   delete req.session.sessionFlash;
//   next();
// });

app.use((req, res, next) => {
  res.locals.user = req.user;
  next();
});

app.use(compression());
app.use(cors());

// Domain handler - Restart server on crashes
app.use(function (req, res, next) {
  const domain = require("domain").create(); // Create a domain for this request

  // Handle errors on this domain
  domain.on("error", function (err) {
    console.error("DOMAIN ERROR CAUGHT\n", err.stack);
    // Log error properly
    try {
      // Failsafe shutdown in 5 seconds
      setTimeout(function () {
        console.error("Failsafe shutdown.");
        process.exit(1);
      }, 5000);

      // Disconnect from the cluster
      const worker = require("cluster").worker;
      if (worker) worker.disconnect();

      // Stop taking new requests
      server.close();
      try {
        // attempt to use Express error route
        next(err);
      } catch (err) {
        // if Express error route failed, try plain Node response
        console.error("Express error mechanism failed.\n", err.stack);
        logger.error(err.stack);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.render("500");
        }
        return;
      }
    } catch (err) {
      console.error("Unable to send 500 response.\n", err.stack);
    }
  });
  // add the request and response objects to the domain
  domain.add(req);
  domain.add(res);

  // execute the rest of the request chain in the domain
  domain.run(next);
});

app.get("/health", (req, res) => {
  return res.sendStatus(200);
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + "-" + Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage: storage });

// const docx = require("./controllers/docx.js");
// const checker = require("./controllers/checker.js");

app.get("/", (req, res) => {
  return res.render("index");
});

const main = require("./controllers/main.js");
const chat = require("./controllers/chat.js");

app.post("/upload", upload.single("file"), main.handleUpload);
app.post("/chat", chat.postChat);

app.get("/404", (req, res) => res.status(404).render("404"));
app.get("/500", (req, res) => res.status(500).render("500"));

// Error: 404
app.use(function (req, res) {
  res.statusCode = 404;
  res.render("404");
});

// The error handler must be before any other error middleware and after all controllers
app.use(Sentry.Handlers.errorHandler());

// Error Handler: 500
if (process.env.NODE_ENV === "development") {
  // only use in development
  app.use(errorhandler());
} else {
  app.use(function (err, req, res, next) {
    console.error(err.stack);
    res.statusCode = 500;
    return res.render("500", { sentry: res.sentry });
  });
}

// Error: 404
app.use(function (req, res) {
  res.statusCode = 404;
  res.render("404");
});

// The error handler must be before any other error middleware and after all controllers
app.use(Sentry.Handlers.errorHandler());

// Error Handler: 500
if (process.env.NODE_ENV === "development") {
  // only use in development
  app.use(errorhandler());
} else {
  app.use(function (err, req, res, next) {
    console.error(err.stack);
    res.statusCode = 500;
    // return res.end(res.sentry);
    return res.render("500", { sentry: res.sentry });
  });
}

// Start Express server.
let server = app.listen(app.get("port"), () => {
  console.log("%s App is running at http://localhost:%d in %s mode", chalk.green("✓"), app.get("port"), app.get("env"));
  console.log("Press CTRL-C to stop\n");
});
