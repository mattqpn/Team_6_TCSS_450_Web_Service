//express is the framework we're going to use to handle requests
const { response } = require('express')
const { request } = require('express')
const express = require('express')

//Access the connection to Heroku Database
const pool = require('../utilities').pool

const validation = require('../utilities').validation
let isStringProvided = validation.isStringProvided

const router = express.Router()

router.put('/', (request, response, next) => {
    
    //Retrieve data from query params
    const email = request.body.email
    const password = request.body.password

    //Verify that the caller supplied all the parameters
    if(isStringProvided(email) 
        && isStringProvided(password)) {
        
        const theQuery = "SELECT MemberId FROM MEMBERS WHERE Members.email=$1"
        const values = [request.auth.email]
        pool.query(theQuery, values)
            .then(result => {
                //stash the memberid into the request object to be used in the next function
                request.memberid = result.rows[0].memberid
                next()
            })
            .catch((error) => {
                //log the error
                console.log("Error on SELECT************************")
                console.log(err)
                console.log("************************")
                console.log(err.stack)
                response.status(400).send({
                    message: err.detail
                })
            })
    } else {
        response.status(400).send({
            message: "Missing required information"
        })
    }
}, (request, response) => {
    //We're storing salted hashes to make our application more secure
    let salt = generateSalt(32)
    let salted_hash = generateHash(request.body.password, salt)

    let theQuery = "UPDATE CREDENTIALS SET SaltedHash = $1, Salt = $2 WHERE MemberId = $3"
    let values = [salted_hash, salt]
    pool.query(theQuery, values)
        .then(result => {
            //We successfully changed te password!
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
                message: "other error, see detail",
                detail: error.detail
            })
        })
})

module.exports = router