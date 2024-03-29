//express is the framework we're going to use to handle requests
const express = require('express')

//Access the connection to Heroku Database
const pool = require('../utilities/exports').pool

const router = express.Router()

/**
 * @apiDefine JSONError
 * @apiError (400: JSON Error) {String} message "malformed JSON in parameters"
 */ 

/**
 * @api {post} /contacts Request to add another user as a contact.
 * @apiName PostContact
 * @apiGroup Contact
 * 
 * @apiDescription Adds the contact from the user associated with the required JWT. 
 * 
 * @apiHeader {String} authorization Valid JSON Web Token JWT
 * 
 * @apiParam {String} contact Username the username of the user to add as a contact
 * @apiParam {Boolean} contact Status the relationship indicator between two accounts (Friends = 1, Not Friends = 0)
 * 
 * @apiSuccess (Success 201) {boolean} success true when the contact is added
 * 
 * @apiError (400: Unknown user) {String} message "unknown username"
 * 
 * @apiError (400: Missing Parameters) {String} message "Missing required information"
 * 
 * @apiError (400: SQL Error) {String} message the reported SQL error details
 * 
 * @apiError (400: Unknown Chat ID) {String} message "invalid contact username"
 * 
 * @apiUse JSONError
 */ 
router.post("/", (request, response, next) => {
    //validate on empty parameters
    if (request.body.chatId === undefined || !isStringProvided(request.body.message)) {
        response.status(400).send({
            message: "Missing required information"
        })
    } else if (isNaN(request.body.chatId)) {
        response.status(400).send({
            message: "Malformed parameter. chatId must be a number"
        })
    } else {
        next()
    }
}, (request, response, next) => {
    //validate chat id exists
    let query = 'SELECT * FROM CHATS WHERE ChatId=$1'
    let values = [request.body.chatId]

    pool.query(query, values)
        .then(result => {
            if (result.rowCount == 0) {
                response.status(404).send({
                    message: "Chat ID not found"
                })
            } else {
                next()
            }
        }).catch(error => {
            response.status(400).send({
                message: "SQL Error on chatid check",
                error: error
            })
        })
}, (request, response, next) => {
            //validate memberid exists in the chat
            let query = 'SELECT * FROM ChatMembers WHERE ChatId=$1 AND MemberId=$2'
            let values = [request.body.chatId, request.decoded.memberid]
        
            pool.query(query, values)
                .then(result => {
                    if (result.rowCount > 0) {
                        next()
                    } else {
                        response.status(400).send({
                            message: "user not in chat"
                        })
                    }
                }).catch(error => {
                    response.status(400).send({
                        message: "SQL Error on member in chat check",
                        error: error
                    })
                })
    
}, (request, response, next) => {
    //add the message to the database
    let insert = `INSERT INTO Messages(ChatId, Message, MemberId)
                  VALUES($1, $2, $3) 
                  RETURNING PrimaryKey AS MessageId, ChatId, Message, MemberId AS email, TimeStamp`
    let values = [request.body.chatId, request.body.message, request.decoded.memberid]
    pool.query(insert, values)
        .then(result => {
            if (result.rowCount == 1) {
                //insertion success. Attach the message to the Response obj
                response.message = result.rows[0]
                response.message.email = request.decoded.email
                //Pass on to next to push
                next()
            } else {
                response.status(400).send({
                    "message": "unknown error"
                })
            }

        }).catch(err => {
            response.status(400).send({
                message: "SQL Error on insert",
                error: err
            })
        })
}, (request, response) => {
        // send a notification of this message to ALL members with registered tokens
        let query = `SELECT token FROM Push_Token
                        INNER JOIN ChatMembers ON
                        Push_Token.memberid=ChatMembers.memberid
                        WHERE ChatMembers.chatId=$1`
        let values = [request.body.chatId]
        pool.query(query, values)
            .then(result => {
                console.log(request.decoded.email)
                console.log(request.body.message)
                result.rows.forEach(entry => 
                    msg_functions.sendMessageToIndividual(
                        entry.token, 
                        response.message))
                response.send({
                    success:true
                })
            }).catch(err => {

                response.status(400).send({
                    message: "SQL Error on select from push token",
                    error: err
                })
            })
})

/**
 * @api {get} /messages/:chatId?/:messageId? Request to get chat messages 
 * @apiName GetMessages
 * @apiGroup Messages
 * 
 * @apiDescription Request to get the 10 most recent chat messages
 * from the server in a given chat - chatId. If an optional messageId is provided,
 * return the 10 messages in the chat prior to (and not including) the message containing
 * MessageID.
 * 
 * @apiParam {Number} chatId the chat to look up. 
 * @apiParam {Number} messageId (Optional) return the 15 messages prior to this message
 * 
 * @apiSuccess {Number} rowCount the number of messages returned
 * @apiSuccess {Object[]} messages List of massages in the message table
 * @apiSuccess {String} messages.messageId The id for this message
 * @apiSuccess {String} messages.email The email of the user who posted this message
 * @apiSuccess {String} messages.message The message text
 * @apiSuccess {String} messages.timestamp The timestamp of when this message was posted
 * 
 * @apiError (404: ChatId Not Found) {String} message "Chat ID Not Found"
 * @apiError (400: Invalid Parameter) {String} message "Malformed parameter. chatId must be a number" 
 * @apiError (400: Missing Parameters) {String} message "Missing required information"
 * 
 * @apiError (400: SQL Error) {String} message the reported SQL error details
 * 
 * @apiUse JSONError
 */ 

    router.get("/", (request, response, next) => {
        let query = 'SELECT * FROM Contacts WHERE MemberID_A=$1'
        let values = [request.decoded.memberid]

        pool.query(query, values)
            .then(result => {
                if (result.rowCount == 0) {
                    response.send({
                        message: "No Contacts"
                    })
                } else {
                    next()
                }
            }).catch(error => {
                response.status(400).send({
                    message: "SQL Error",
                    error: error
                })
            })
    }, (request, response) => {
        //perform the Select

        let query = `SELECT Members.Username, Contacts.Verified
                    FROM Contacts 
                    INNER JOIN Members ON (Contacts.MemberID_B = Members.MemberID)
                    WHERE MemberID_A=$1 AND Verified=1`
        let values = [request.decoded.memberid]
        pool.query(query, values)
            .then(result => {
                response.send({
                    rowCount : result.rowCount,
                    rows: result.rows
                })
            }).catch(err => {
                response.status(400).send({
                    message: "SQL Error",
                    error: err
                })
            })
});

    router.get("/search", (request, response) => {
        let query = 'SELECT Username FROM MEMBERS WHERE Username LIKE %$1%'
        let values = [request.params.username]

        pool.query(query, values)
            .then(result => {
                if (result.rowCount == 0) {
                    response.send({
                        message: "User Not Found."
                        // username : request.params.username,
                        // rowCount : result.rowCount,
                        // rows: result.rows
                    })
                } else {
                    response.send({
                        username : request.params.username,
                        rowCount : result.rowCount,
                        rows: result.rows
                    })
                }
            }).catch(error => {
                response.status(400).send({
                    message: "SQL Error",
                    error: error
                })
            })
    });

module.exports = router