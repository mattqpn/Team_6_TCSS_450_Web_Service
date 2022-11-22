//express is the framework we're going to use to handle requests
const express = require('express')

//Access the connection to Heroku Database
const pool = require('../utilities/exports').pool

const router = express.Router()

const validation = require('../utilities').validation

/**
 * Unfinished function to request a connection with a member
 */
router.post("/:memberId/", (request, response, next) => {
    //validate on empty parameters
    if (!request.params.memberId) {
        response.status(400).send({
            message: "Missing required information"
        })
    } else if (isNaN(request.params.chatId)) {
        response.status(400).send({
            message: "Malformed parameter. memberId must be a number"
        })
    } else {
        next()
    }
}, (request, response, next) => {
    //validate email exists 
    let query = 'SELECT * FROM MEMBERS WHERE MemberId=$1'
    let values = [request.decoded.memberid]

console.log(request.decoded)

    pool.query(query, values)
        .then(result => {
            if (result.rowCount == 0) {
                response.status(404).send({
                    message: "email not found"
                })
            } else {
                //user found
                next()
            }
        }).catch(error => {
            response.status(400).send({
                message: "SQL Error",
                error: error
            })
        })
}, (request, response) => {
    //Insert the memberId into the contacts
    
    }
)

module.exports = router