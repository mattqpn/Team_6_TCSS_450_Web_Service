//express is the framework we're going to use to handle requests
const { response } = require('express')
const { request } = require('express')
const express = require('express')

//Access the connection to Heroku Database
const pool = require('../utilities').pool

const validation = require('../utilities').validation
let isStringProvided = validation.isStringProvided

const generateHash = require('../utilities').generateHash
const generateSalt = require('../utilities').generateSalt

const sendEmail = require('../utilities').sendEmail

const router = express.Router()

/**
 * @api {post} /password Request to change password
 * @apiName PostPassword
 * 
 * @apiParam {String} email a users email *unique
 * @apiParam {String} oldPassword a users old password
 * @apiParam {String} newPassword a users new password
 * 
 * @apiParamExample {json} Request-Body-Example:
 *  {
 *      "email":"cfb3@fake.email",
 *      "oldPassword":"test12345"
 *      "newPassword":"new12345"
 *  }
 * 
 * @apiSuccess (Success 201) {boolean} success true when the password is updated
 * @apiSuccess (Success 201) {String} email the email of the user updated
 * 
 * @apiError (400: Missing Parameters) {String} message "Missing required information"'
 * 
 * @apiError (404: User not found) {String} message "User not found"
 * 
 * @apiError (400: Invalid Credentials) {String} message "Credentials did not match"
 *  
 * @apiError (400: Other Error) {String} message "other error, see detail"
 * @apiError (400: Other Error) {String} detail Information about the error
 * 
 */
router.post('/', (request, response, next) => {

    //Retrieve data from query params
    const email = request.body.email
    const oldPassword = request.body.oldPassword
    const newPassword = request.body.newPassword

    //Verify that the caller supplied all the parameters
    if(isStringProvided(email) 
        && isStringProvided(oldPassword)
        && isStringProvided(newPassword)) {
        next()
    } else {
        response.status(400).send({
            message: "Missing required information"
        })
    }
}, (request, response, next) => {
    // verify password
    const theQuery = `SELECT saltedhash, salt, Credentials.memberid FROM Credentials
                      INNER JOIN Members ON
                      Credentials.memberid=Members.memberid 
                      WHERE Members.email=$1`
    const values = [request.body.email]
    pool.query(theQuery, values)
        .then(result => {
            if (result.rowCount == 0) {
                response.status(404).send({
                    message: 'User not found' 
                })
                return
            }
            
            //stash the memberid into the request object to be used in the next function
            request.memberid = result.rows[0].memberid

            //Retrieve the salt used to create the salted-hash provided from the DB
            let salt = result.rows[0].salt
            
            //Retrieve the salted-hash password provided from the DB
            let storedSaltedHash = result.rows[0].saltedhash 

            //Generate a hash based on the stored salt and the provided password
            let providedSaltedHash = generateHash(request.body.oldPassword, salt)

            //Did our salted hash match their salted hash?
            if (storedSaltedHash === providedSaltedHash ) {
                 next()
            } else {
                //credentials dod not match
                response.status(400).send({
                    message: 'Credentials did not match' 
                })
            }
        })
        .catch((err) => {
            //log the error
            console.log("Error on SELECT************************")
            console.log(err)
            console.log("************************")
            console.log(err.stack)
            response.status(400).send({
                message: "other error, see detail",
                message: err.detail
            })
        })

}, (request, response) => {
    //We're storing salted hashes to make our application more secure
    let salt = generateSalt(32)
    let salted_hash = generateHash(request.body.newPassword, salt)

    let theQuery = "UPDATE CREDENTIALS SET SaltedHash = $1, Salt = $2 WHERE MemberId=$3"
    let values = [salted_hash, salt, request.memberid]
    pool.query(theQuery, values)
        .then(result => {
            //We successfully changed the password!
            response.status(201).send({
                success: true,
                message: 'Password changed!',
                email: request.body.email
            })
            sendEmail("AppRaindrop@gmail.com", request.body.email, "Password Changed!", "Your password has been changed.")
        })
        .catch((error) => {
            //log the error for debugging
            console.log("PWD change")
            console.log(error)

            response.status(400).send({
                message: "other error, see detail",
                detail: error.detail
            })
        })
})

module.exports = router