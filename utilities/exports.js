//Get the connection to Heroku Database
const pool = require('./sql_conn.js')

//Get the crypto utility functions
const credUtils = require('./credentialingUtils')
const generateHash = credUtils.generateHash
const generateSalt = credUtils.generateSalt
const generateCode = credUtils.generateCode

const validation = require('./validationUtils.js')

const sendEmail = require('./email.js').sendEmail

let messaging = require('./pushy_utilities.js')

module.exports = { 
    pool, generateHash, generateSalt, validation, sendEmail, messaging, generateCode
}
