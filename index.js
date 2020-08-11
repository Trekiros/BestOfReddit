const axios = require('axios').default
const moment = require('moment')
const fs = require('fs')
const { months, days, sleep } = require('./src/util').default

const subreddits = [
    { name: 'UnearthedArcana', exclude: ['Arcana Forge'] },
    { name: 'DnDBehindTheScreen', exclude: ["Weekly Discussion"] },
    { name: 'DnDHomebrew', exclude: [] },
    { name: 'DMAcademy', exclude: [] },
    { name: 'BattleMaps', exclude: [] },
    { name: 'DnDMaps', exclude: [] },
]

async function run() {
    const creationStats = { day: {}, hour: {} }
    for (const day of days) creationStats.day[day] = 0 // make sure the days appear in chronological order rather than in whichever order the reddit posts are found
    delete creationStats.day.none

    for (let i = 0 ; i < subreddits.length ; i++) {
        const { name: subredditName, exclude: excludeTerms } = subreddits[i]
        console.log(`Starting ${subredditName}...`)

        const subredditMetadata = await axios.get(`http://www.reddit.com/r/${subredditName}/about.json`)
        const subredditCreationTimestamp = subredditMetadata.data.data.created_utc * 1000

        let fileName = `./output/${subredditName}.csv`
        let fileContent = 'Year,Month,Flair,Title,Author,URL\n' // Headers
    
        let end = moment().startOf('month')
        while (end.isAfter(moment(subredditCreationTimestamp))) {
            const now = Date.now()
            const start = moment(end).subtract(1, 'month')            
            console.log(`${subredditName} - ${months[start.month()]} ${start.year()}`)

            const query = 'https://api.pushshift.io/reddit/search/submission/?metadata=true&frequency=hour&advanced=false&sort=desc&domain=&sort_type=num_comments'
                + (excludeTerms.length ? `&q=${excludeTerms.map(term => `-"${term}`).join(' ')}"` : '')
                + `&after=${start.valueOf()/1000}`
                + `&before=${end.valueOf()/1000}`
                + `&subreddit=${subredditName}`
                + '&size=10'
            fileContent += `${start.year()},${months[start.month()]}\n`
            const response = await axios.get(query)
            response.data.data.forEach(redditPost => {
                const creation = moment(redditPost.created_utc * 1000)
    
                // Print csv row
                fileContent += (
                    `${creation.year()}`
                    + `,${months[creation.month()]}`
                    +`,${redditPost.link_flair_text || '-'}`
                    +`,"${redditPost.title.replace('&amp;', '&').replace('"', '""')}"`
                    +`,/u/${redditPost.author}`
                    +`,${redditPost.full_link}`
                    +'\n'
                )
    
                // Gather stats
                creationStats.day[days[creation.isoWeekday()]] = (creationStats.day[days[creation.isoWeekday()]] || 0) + 1
                creationStats.hour[`${creation.hour()}`] = (creationStats.hour[`${creation.hour()}`] || 0) + 1
            })
    
            end = start
    
            // Avoid the "too many requests" error by throttling requests by at least one second
            await sleep(Math.max(100, 1000 - (Date.now() - now)))
        }
    
        fs.writeFileSync(fileName,fileContent,{encoding:'utf8',flag:'w'})
    }

    console.log(creationStats)
}

run().then(() => {}).catch(e => console.error(e))
