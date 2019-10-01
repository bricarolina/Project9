const Sequelize = require ('sequelize');

module.exports = (sequelize) => {
  class User extends Sequelize.Model {}
  User.init({
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        firstName: {
          type: Sequelize.STRING,
          allowNull: false,
          validate: {
            notNull: {
              msg: 'Please provide a value for "first name"'
            },
            notEmpty: {
              msg: 'Please provide a value for "first name"'
            }
          }
        },
        lastName: {
          type: Sequelize.STRING,
          allowNull: false,
          validate: {
            notNull: {
              msg: 'Please provide a value for "last name"'
            },
            notEmpty: {
              msg: 'Please provide a value for "last name"'
            }
          }
        },
        emailAddress: {
          type: Sequelize.STRING,
          allowNull: false,
          validate: {
            notNull: {
              msg: 'Please provide a value for "email"'
            },
            notEmpty: {
              msg: 'Please provide a value for "email"'
            }
          }
        },
        password: {
          type: Sequelize.STRING,
          allowNull: false,
          validate: {
            notNull: {
              msg: 'Please provide a value for "password"'
            },
            notEmpty: {
              msg: 'Please provide a value for "password"'
            },
            min:{
              args: 8,
              msg: "Please provide a password between 8 and 20 characters long"
            },
            max: {
              args: 20,
              msg: "Please provide a password between 8 and 20 characters long"
            }
          }
        }
      },
      {sequelize});

  User.associate = (models) => {
    User.hasMany(models.Course, {
      foreignKey: {
        fieldName: 'userId',
        allowNull: false,
      },
    });
  };

  return User;
};