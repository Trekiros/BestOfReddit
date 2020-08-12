const readline = require('readline')
const { google } = require('googleapis')
const fs = require('fs')
const util = require('util')

function promisify(thisArg, methodName) {
    return util.promisify(thisArg[methodName].bind(thisArg))
}

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const TOKEN_PATH = './token.json'

/**
 * Source: https://developers.google.com/sheets/api/quickstart/nodejs (modified to benefit from async/await)
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
async function authorize(credentials) {
    const {client_secret, client_id, redirect_uris} = credentials.installed
    const oAuth2Client = new google.auth.OAuth2(
        client_id, client_secret, redirect_uris[0])

    // Check if we have previously stored a token.
    try {
        const token = fs.readFileSync(TOKEN_PATH)
        oAuth2Client.setCredentials(JSON.parse(token))
        return oAuth2Client
    } catch (err) {
        return getNewToken(oAuth2Client)
    }
}

/**
 * Source: https://developers.google.com/sheets/api/quickstart/nodejs (modified to benefit from async/await)
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
async function getNewToken(oAuth2Client) {
    const authUrl = oAuth2Client.generateAuthUrl({ access_type: 'offline', scope: SCOPES })
    console.log('Authorize this app by visiting this url:', authUrl)
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

    return new Promise((resolve, reject) => {
        rl.question('Enter the code from that page here: ', (code) => {
            rl.close()
            oAuth2Client.getToken(code, (err, token) => {
                if (err) {
                    reject(err)
                }

                oAuth2Client.setCredentials(token)
                
                // Store the token to disk for later program executions
                fs.writeFileSync(TOKEN_PATH, JSON.stringify(token))

                resolve(oAuth2Client)
            })
        })
    })
}

exports.default = async ({ credentials, spreadsheetId }) => {
    const auth = await authorize(credentials)
    const { spreadsheets } = google.sheets({version: 'v4', auth});

    const getRange = async (range) => promisify(spreadsheets.values, 'get')({ spreadsheetId, range })
    //const insertRows = async (position, nbToInsert) => promisify(spreadsheets)

    return {
        getRange
    }
}