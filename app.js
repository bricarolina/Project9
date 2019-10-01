'use strict';

// inserting moduals
const cors = require('cors');
const express = require('express');
const morgan = require('morgan');
const Sequelize = require('sequelize');
const {check, validationResult} = require('express-validator');
const bodyParser = require('body-parser');
const bcryptjs = require('bcryptjs');
const auth = require('basic-auth');

//SEQUELIZE
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './fsjstd-restapi.db'
});
// resets the sequencing to zero so new entries replace missing IDs from deleted entries
const db = {sequelize, Sequelize, models: {}};
db.models.User = require('./models/User')(sequelize);
db.models.Course = require('./models/Course')(sequelize);
const {User, Course} = db.models;

// variable to enable global error logging
const enableGlobalErrorLogging = process.env.ENABLE_GLOBAL_ERROR_LOGGING === 'true';

// create the Express app
const app = express();

// enable ALL CORS Requests
app.use(cors());

// allows attributes from the request body to be read
app.use(bodyParser.urlencoded({extended: false}));

app.use(express.json());

// this array is used to keep track of user records as they are created
let users = [];
let messages = [];


// setup morgan which gives us http request logging
app.use(morgan('dev'));


sequelize
    .authenticate()
    .then(() => {
      console.log('Connection has been established successfully.');
    })
    .catch(err => {
      console.error('Unable to connect to the database:', err);
    });

// verifies user passwords and allows access to routes
const authenticateUser = async (req, res, next) => {
  let message = null;
  // parsing the user's credentials from the Authorization header.
  const credentials = auth(req);
  console.log(credentials);
  users = await User.findAll();
  // if the user's credentials are available 

  if (credentials) {
    // attempt to retrieve the user from the data store
    // by their email 
    const user = users.find(u => u.emailAddress === credentials.name);
    // if a user was successfully retrieved from the data store...
    if (user) {
      // uses the bcryptjs npm to compare the user's password
      // (from the Authorization header) to the user's password
      // that was retrieved from the data store.
      const authenticated = bcryptjs
          .compareSync(credentials.pass, user.password);
      // if the passwords match...
      if (authenticated) {
        // then store the retrieved user object on the request object
        // so any middleware functions will have access to the user's information.
        req.currentUser = user;
      } else {
        message = `Authentication failure for email: ${user.email}`;
      }
    } else {
      message = `User not associated with email: ${credentials.email}`;

    }
  } else {
    message = 'Auth header not found';
  }
// if user authentication failed...
  if (message) {
    console.warn(message);

    // return a response with a 401 Unauthorized HTTP status code.
    res.status(401).json({message: 'Access Denied'});
  } else {

    next();
  }
};

// async Handler
function asyncHandler(cb) {
  return async (req, res, next) => {
    try {
      await cb(req, res, next);
    } catch (err) {
      messages.length = 0;
      if (err.name === 'SequelizeValidationError') {
        messages = err.errors.map(err => err.message);
        console.error('Validation errors: ', messages);
        res.status(err.status || 500).json({
          message: messages,
          error: {err},
        });
      }
      next(err);
    }
  }
}

// setup a friendly greeting for the root route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to my REST API project!  The following routes are ' +
        'accessible: /api/users, ' +
        '/api/courses, ' +
        '/api/courses/:id' + '.'
  });
});


// returns the current authenticated user
app.get('/api/users', authenticateUser, asyncHandler(async (req, res) => {
  //return authenticated user
  const currentUser = req.currentUser;
  let users = await User.findAll({attributes: ["id", "firstName", "lastName", "emailAddress"]});
  const user = users.find(u => u.emailAddress === currentUser.emailAddress);
  res.json(user);
  res.status(200).end();
}));

// creates a user, sets the location header to "/", and returns no content
app.post('/api/users',
    [
      check('firstName')
          .exists({checkNull: true, checkFalsy: true})
          .withMessage('Please provide a value for "first name"'),
      check('lastName')
          .exists({checkNull: true, checkFalsy: true})
          .withMessage('Please provide a value for "last name"'),
      check('emailAddress')
          .exists({checkNull: true, checkFalsy: true})
          .withMessage('Please provide a value for "email"')
          .isEmail()
          .withMessage('Please provide a valid email address for "email"'),
      check('password')
          .exists({checkNull: true, checkFalsy: true})
          .withMessage('Please provide a value for "password"')
          .isLength({min: 8, max: 20})
          
          .withMessage('Please provide a value for "password" that is between 8 and 20 characters in length'),
      // check('passwordConfirmation')
      //     .exists({ checkNull: true, checkFalsy: true })
      //     .withMessage('Please provide a value for "passwordConfirmation"')
      //     .custom((value, { req }) => {
    
    ], asyncHandler(
        async (req, res) => {
          const errors = validationResult(req);

          if (!errors.isEmpty()) {
            // use the Array `map()` method to get a list of error messages.
            const errorMessages = errors.array().map(error => error.msg);

            // return the validation errors to the client.
            res.status(400).json({errors: errorMessages});
          } else {
            let users = await User.findAll({});
            const user = users.find(u => u.emailAddress === req.body.emailAddress);
            if (!user) {
              let password = req.body.password;
              let hashedPassword = bcryptjs.hashSync(password, 10);
              // generates a new user from the body attributes
              const newUser = {
                firstName: req.body.firstName,
                lastName: req.body.lastName,
                emailAddress: req.body.emailAddress,
                password: hashedPassword
              };
              // add the user to the `users` table.
              User.findOrCreate({where: newUser});
              res.location('/');
              res.status(201).end();
            } else {
              // return the validation errors to the client.
              res.status(400).json({
                errors: "That email address is already registered, unable to create user. " +
                    "Please try again with a new email address"
              });
            }
          }
        })
);


// returns the current authenticated user
app.get('/api/courses', asyncHandler(async (req, res) => {
  let courses = await sequelize.query("SELECT courses.id, title, description, estimatedTime, materialsNeeded, userId, firstName, lastName, emailAddress, password FROM courses INNER JOIN users ON Courses.userId = Users.Id", {type: sequelize.QueryTypes.SELECT});
  //return courses
      res.json(courses);
      res.status(200).end();
    }
));
// bri o

// creates a course, sets the location header to the course url, and returns no content
app.post('/api/courses', authenticateUser,
    [
      check('title')
          .exists({checkNull: true, checkFalsy: true})
          .withMessage('Please provide a value for "title"'),
      check('description')
          .exists({checkNull: true, checkFalsy: true})
          .withMessage('Please provide a value for "description"')
    ], asyncHandler(
        async (req, res) => {
          //return authenticated user
          const user = req.currentUser;
          const errors = validationResult(req);
          if (!errors.isEmpty()) {
            // use the Array `map()` method to get a list of error messages.
            const errorMessages = errors.array().map(error => error.msg);
            // return the validation errors to the client.
            res.status(400).json({errors: errorMessages});
          } else {
            // generates a new user from the body attributes
            const newCourse = req.body;
            // add the user to the `users` table.
            const createdCourse = await Course.findOrCreate({where: newCourse});
            let findCourse = await Course.findAll({where: newCourse});
            res.location(`/api/courses/${findCourse[0].id}`);
            res.status(201).end();
          }
        })
);

// creates a course, sets the location header to the course url, and returns no content
app.put('/api/courses/:id', authenticateUser,
    [
      check('title')
          .exists({checkNull: true, checkFalsy: true})
          .withMessage('Please provide a value for "title"'),
      check('description')
          .exists({checkNull: true, checkFalsy: true})
          .withMessage('Please provide a value for "description"')
    ], asyncHandler(
        async (req, res) => {
          //return authenticated user
          const user = req.currentUser;

          const errors = validationResult(req);
          if (!errors.isEmpty()) {
            // use the Array `map()` method to get a list of error messages.
            const errorMessages = errors.array().map(error => error.msg);
            // return the validation errors to the client.
            res.status(400).json({errors: errorMessages});
          } else {
            let courses = await sequelize.query(`SELECT courses.id, title, description, estimatedTime, materialsNeeded, userId, firstName, lastName, emailAddress, password FROM courses INNER JOIN users ON Courses.userId = Users.Id WHERE Courses.userId IS ${user.id} AND Courses.id IS ${req.params.id}`, {type: sequelize.QueryTypes.SELECT});
            if (courses.length > 0) {
              let id = req.params.id;
              let updatedCourse = req.body;
              Course.update(updatedCourse, {where: {id}});
              // updates a course from the body attributes in the PUT request
              res.location(`/api/courses/${id}`);
              res.status(204).end();
            } else {
              res.status(403).json({errors: "You do not have permission to update this course"}).end();
            }
          }
        })
);

// deletes a course, and returns no content
app.delete('/api/courses/:id', authenticateUser,
    asyncHandler(
        async (req, res) => {
          const user = req.currentUser;
          const errors = validationResult(req);
          if (!errors.isEmpty()) {
            // use the Array `map()` method to get a list of error messages.
            const errorMessages = errors.array().map(error => error.msg);
            // return the validation errors to the client.
            res.status(400).json({errors: errorMessages});
          } else {
            let courses = await sequelize.query(`SELECT courses.id, title, description, estimatedTime, materialsNeeded, userId, firstName, lastName, emailAddress, password FROM courses INNER JOIN users ON Courses.userId = Users.Id WHERE Courses.userId IS ${user.id} AND Courses.id IS ${req.params.id}`, {type: sequelize.QueryTypes.SELECT});
            console.log(courses);
            if (courses.length > 0) {
              let id = req.params.id;
              Course.destroy({where: {id}});
              res.location(`/api/courses`);
              res.status(204).end();
            } else {
              res.status(403).json({errors: "You do not have permission to delete this course"}).end();
            }
          }
        })
);
//-----
// returns all courses including the user that owns each course for the provided course ID
app.get('/api/courses/:id', asyncHandler(async (req, res) => {
      let id = req.params.id;
  let courses = await sequelize.query(`SELECT courses.id, title, description, estimatedTime, materialsNeeded, userId, firstName, lastName, emailAddress, password FROM courses INNER JOIN users ON Courses.userId = Users.Id WHERE Courses.id IS ${id}`, {type: sequelize.QueryTypes.SELECT});
      //return courses
      res.json(courses);
      res.status(200).end();
    }
));

// send 404 if no other route matched
app.use((req, res) => {
  res.status(404).json({
    message: 'Route Not Found',
  });
});

// setup a global error handler
app.use((err, req, res, next) => {
  if (enableGlobalErrorLogging) {
    console.error(`Global error handler: ${JSON.stringify(err.stack)}`);
  }

  res.status(err.status || 500).json({
    message: err.message,
    error: {err},
  });
});

// set our port
app.set('port', process.env.PORT || 5000);

// start listening on our port
const server = app.listen(app.get('port'), () => {
  console.log(`Express server is listening on port ${server.address().port}`);
});