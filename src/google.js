const moment = require('moment')
const readline = require('readline')
const { google } = require('googleapis')
const fs = require('fs')
const { httpGet, months } = require('./util').default

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
        const token = process.env['googleToken'] ? process.env['googleToken'] : fs.readFileSync(TOKEN_PATH)
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
                    return reject(err)
                }

                oAuth2Client.setCredentials(token)
                
                // Store the token to disk for later program executions
                fs.writeFileSync(TOKEN_PATH, JSON.stringify(token))

                resolve(oAuth2Client)
            })
        })
    })
}

exports.default = async ({ credentials, spreadsheetId }, subreddits) => {
    const descriptionBySheetName = {}
    subreddits.forEach(subreddit => descriptionBySheetName[subreddit.name] = subreddit.description)

    const auth = await authorize(credentials)
    const { spreadsheets } = google.sheets({version: 'v4', auth});

    const sheetMap = {}
    const getOrCreateSheet = async (sheetName) => {
        // 1. If the sheet is already known, retrieve it from memory
        if (sheetMap[sheetName]) {
            return sheetMap[sheetName]
        }

        // 2. Retrieve existing sheet
        const spreadsheetMetadata = await spreadsheets.get({ auth, spreadsheetId })
        const existingSheet = spreadsheetMetadata.data.sheets.find(sheet => sheet.properties.title === sheetName)
        if (existingSheet) {
            return existingSheet
        }

        // 3. Create sheet
        const newSheetResponse = await spreadsheets.batchUpdate({
            spreadsheetId, auth,
            requestBody: {
                requests: [
                    {
                        addSheet: {
                            properties: {
                                title: sheetName,
                            }
                        }
                    }
                ]
            }
        })
        const newSheet = newSheetResponse.data.replies.find(reply => !!reply.addSheet).addSheet

        // 4. Set headers
        await spreadsheets.values.append({
            spreadsheetId, auth,
            range: `${sheetName}!A1:F4`,
            valueInputOption: 'RAW',
            insertDataOption: 'INSERT_ROWS',
            requestBody: { values: [
                [`\t\t\tr/${sheetName} Monthly Top 10`],
                [`"${descriptionBySheetName[sheetName]}"`],
                [],
                ['Year','Month','Type','Title','Creator','URL'],
            ] },
        })

        // 5. Apply style
        const sheetId = newSheet.properties.sheetId
        const borderStyle = {
            style: 'SOLID',
            width: 1,
            color: { red: 0.0, green: 0.0, blue: 0.0 },
        }
        await spreadsheets.batchUpdate({
            spreadsheetId, auth,
            requestBody: {
                requests: [
                    // Title in A1
                    {
                        mergeCells: {
                            range: {
                                sheetId,
                                startRowIndex: 0,
                                endRowIndex: 1,
                                startColumnIndex: 0,
                                endColumnIndex: 4,
                            },
                            mergeType: 'MERGE_ALL',
                        }
                    },
                    {
                        repeatCell: {
                            range: {
                                sheetId,
                                startRowIndex: 0,
                                endRowIndex: 1,
                            },
                            cell: {
                                userEnteredFormat: {
                                    textFormat: {
                                        fontSize: 14,
                                        bold: true,
                                    },
                                },
                            },
                            fields: 'userEnteredFormat(textFormat)',
                        }
                    },

                    // Description in 2:3
                    {
                        mergeCells: {
                            range: {
                                sheetId,
                                startRowIndex: 1,
                                endRowIndex: 3,
                            },
                            mergeType: 'MERGE_ALL',
                        }
                    },

                    // Headers in A4:F4
                    {
                        repeatCell: {
                            range: {
                                sheetId,
                                startRowIndex: 3,
                                endRowIndex: 4,
                                startColumnIndex: 0,
                                endColumnIndex: 6,
                            },
                            cell: {
                                userEnteredFormat: {
                                    backgroundColor: { red: 0.953, green: 0.953, blue: 0.953 },
                                    textFormat: { fontSize: 12, bold: true },
                                },
                            },
                            fields: 'userEnteredFormat(backgroundColor, textFormat)',
                        }
                    },
                    {
                        updateBorders: {
                            range: {
                                sheetId,
                                startRowIndex: 3,
                                endRowIndex: 4,
                                startColumnIndex: 0,
                                endColumnIndex: 6,
                            },
                            top: borderStyle,
                            bottom: borderStyle,
                            left: borderStyle,
                            right: borderStyle,
                        },
                    },

                    // Set column widths
                    ...[84, 84, 84, 588, 252, 252].map((pixelSize, index) => ({
                        updateDimensionProperties: {
                            range: {
                                sheetId,
                                dimension: 'COLUMNS',
                                startIndex: index,
                                endIndex: index + 1,
                            },
                            properties: { pixelSize },
                            fields: 'pixelSize',
                        },
                    })),

                    // Set column D's text wrap
                    {
                        repeatCell: {
                            range: {
                                sheetId,
                                startColumnIndex: 3,
                                endColumnIndex: 5,
                            },
                            cell: {
                                userEnteredFormat: {
                                    wrapStrategy: 'WRAP',
                                },
                            },
                            fields: 'userEnteredFormat(wrapStrategy)',
                        }
                    },

                    // Set frozen rows
                    {
                        updateSheetProperties: {
                            properties: {
                                sheetId,
                                gridProperties: {
                                    frozenRowCount: 4,
                                    hideGridlines: true,
                                },
                            },
                            fields: 'gridProperties.frozenRowCount',
                        }
                    }
                ]
            },
        })

        sheetMap[sheetName] = newSheet
        return newSheet
    }

    const getRange = async (subredditName, range) => {
        await getOrCreateSheet(subredditName)
        const response = await spreadsheets.values.get({ spreadsheetId, range: `${subredditName}!${range}` })
        return response.data.values
    }

    const getEarliest = async (subredditName) => {
        const latestKnownRow = await getRange(subredditName, 'A5:B5')

        // Sheet already exists: start from the first unknown month
        if (latestKnownRow && latestKnownRow[0][0] && latestKnownRow[0][1]) {
            const latestKnownTimestamp = moment().startOf('month')
                .year(latestKnownRow[0][0])
                .month(months.indexOf(latestKnownRow[0][1]))
                .add(1, 'month')

            return latestKnownTimestamp.valueOf()
        }
        
        // Sheet did not exist: start from the subreddit's creation
        else {
            const subredditMetadata = await httpGet(`http://www.reddit.com/r/${subredditName}/about.json`)
            return subredditMetadata.created_utc * 1000
        }
    }
    
    /**
     * Inserts and styles a topN into a sheet
     * @param {string} subredditName
     * @param {{ month: string, year: number, top: { flair: string, title: string, author: string, url: string }[] }} values 
     */
    const insertTop = async (subredditName, values) => {
        const sheet = await getOrCreateSheet(subredditName)
        const sheetId = sheet.properties.sheetId

        // Create empty rows
        const startIndex = 4
        const endIndex = startIndex + values.top.length + 1 /* part header */ + 1 /* empty line between each month */
        await spreadsheets.batchUpdate({
            spreadsheetId, auth,
            requestBody: {
                requests: [
                    // Create the rows (this copies the formatting from the first row onto each of the new rows individually)
                    {
                        insertDimension: {
                            range: {
                                sheetId,
                                dimension: 'ROWS',
                                startIndex,
                                endIndex,
                            },
                            inheritFromBefore: true,
                        }
                    },

                    // Insert values
                    {
                        updateCells: {
                            range: {
                                sheetId,
                                startRowIndex: startIndex,
                                endRowIndex: endIndex,
                            },
                            rows: [
                                // Part Header
                                { values: [{
                                    userEnteredValue: { numberValue: values.year },
                                }, {
                                    userEnteredValue: { stringValue: values.month },
                                }] },
            
                                // values.top, as spreadsheet rows
                                ...values.top.map(top => ({ values: [
                                    { userEnteredValue: { numberValue: values.year } },
                                    { userEnteredValue: { stringValue: values.month } },
                                    { userEnteredValue: { stringValue: top.flair } },
                                    { userEnteredValue: { stringValue: top.title } },
                                    { userEnteredValue: { stringValue: top.author } },
                                    { userEnteredValue: { stringValue: top.url } },
                                ]})),
                            ],
                            // userEnteredFormat is not specified, to it is cleared for this range
                            fields: 'userEnteredValue,userEnteredFormat',
                        }
                    },

                    // Apply style
                    {
                        repeatCell: {
                            range: {
                                sheetId,
                                startRowIndex: startIndex,
                                endRowIndex: startIndex + 1,
                                startColumnIndex: 0,
                                endColumnIndex: 2,
                            },
                            cell: {
                                userEnteredFormat: {
                                    textFormat: { bold: true },
                                },
                            },
                            fields: 'userEnteredFormat(textFormat)',
                        }
                    },
                    {
                        repeatCell: {
                            range: {
                                sheetId,
                                startRowIndex: startIndex +1,
                                endRowIndex: endIndex,
                                startColumnIndex: 0,
                                endColumnIndex: 2,
                            },
                            cell: {
                                userEnteredFormat: {
                                    textFormat: { foregroundColor: { red: 0.8, blue: 0.8, green: 0.8 } },
                                },
                            },
                            fields: 'userEnteredFormat(textFormat)',
                        }
                    },
                    {
                        updateBorders: {
                            range: {
                                sheetId,
                                startRowIndex: startIndex,
                                endRowIndex: endIndex -1,
                                startColumnIndex: 0,
                                endColumnIndex: 6,
                            },
                            top: { style: 'SOLID', width: 1, color: { red: 0.0, green: 0.0, blue: 0.0 } },
                            bottom: { style: 'SOLID', width: 1, color: { red: 0.0, green: 0.0, blue: 0.0 } },
                            left: { style: 'SOLID', width: 1, color: { red: 0.0, green: 0.0, blue: 0.0 } },
                            right: { style: 'SOLID', width: 1, color: { red: 0.0, green: 0.0, blue: 0.0 } },
                            innerVertical: { style: 'SOLID', width: 1, color: { red: 0.72, green: 0.72, blue: 0.72 } },
                        },
                    },
                ],
            },
        })
    }



    // Create all of the sheets that need to be created when the job is started
    await Promise.all(
        subreddits.map(async (subreddit) => getOrCreateSheet(subreddit.name))
    )

    return {
        getEarliest, insertTop, getOrCreateSheet
    }
}
