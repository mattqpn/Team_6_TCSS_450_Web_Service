//express is the framework we're going to use to handle requests
const { response } = require('express')
const { request } = require('express')
const express = require('express')

//Access the connection to Heroku Database
const pool = require('../utilities').pool

const validation = require('../utilities').validation
let isStringProvided = validation.isStringProvided

const generateHash = require('../utilities').generateHash

const router = express.Router()

/**
 * @api {post} /password Request to change password
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
    const values = [email]
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
            let providedSaltedHash = generateHash(oldPassword, salt)

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
                message: "other error, see detail 2",
                message: err.detail
            })
        })

}, (request, response) => {
    //We're storing salted hashes to make our application more secure
    let salt = generateSalt(32)
    let salted_hash = generateHash(newPassword, salt)

    let theQuery = "UPDATE CREDENTIALS SET SaltedHash = $1, Salt = $2 WHERE MemberId = $3"
    let values = [salted_hash, salt, request.memberid]
    pool.query(theQuery, values)
        .then(result => {
            //We successfully changed the password!
            response.status(201).send({
                success: true,
                email: request.body.email
            })
            sendEmail("our.email@lab.com", request.body.email, "Password Changed!", "Your password has been changed.")
        })
        .catch((error) => {
            //log the error for debugging
            console.log("PWD change")
            console.log(error)

            response.status(400).send({
                message: "other error, see detail 3",
                detail: error.detail
            })
        })
})

module.exports = router