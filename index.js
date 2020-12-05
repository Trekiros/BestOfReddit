const moment = require('moment')
const fs = require('fs')
const yaml = require('js-yaml')
const GoogleService = require('./src/google').default
const RedditService = require('./src/reddit').default
const { months, sleep } = require('./src/util').default

async function run() {
    // If you have a no such file error here, make a local copy of conf-template.yml, named conf.yml
    const confFile = process.env['conf'] || fs.readFileSync('./conf.yml')
    const { subreddits, conf, spreadsheet, reddit } = yaml.load(confFile)

    const googleService = await GoogleService(spreadsheet, subreddits)
    const redditService = await RedditService(reddit)

    // fori instead of foreach in order to stay in the async scope
    for (let i = 0 ; i < subreddits.length ; i++) {
        const subredditConf = subreddits[i]
        const { name: subredditName } = subredditConf
        console.log(`Starting ${subredditName}...`)

        // Calculate timeslot of the job
        const earliest = await googleService.getEarliest(subredditName)
        const latest = moment().subtract(4, 'days').startOf('month') // If ran daily, the sheet is updated on the 5th of each month

        let start = moment(earliest)
        while (start.isBefore(latest)) {
            const end = moment(start).add(1, 'month')            
            console.log(`${subredditName} - ${months[start.month()]} ${start.year()}`)

            const topPosts = await redditService.getTopPosts(
                subredditConf, 
                start, 
                end, 
                conf.size
            )

            await googleService.insertTop(subredditName, {
                month: months[start.month()],
                year: start.year(),
                top: topPosts.map(redditPost => ({
                    flair: redditPost.link_flair_text || '-',
                    title: redditPost.title.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>').replace('"', '""'),
                    author: redditPost.author,
                    score: redditPost.score,
                    url: `http://www.reddit.com/${redditPost.id}`,
                }))
            })
            
            // Avoid the "too many requests" error by throttling requests by at least one second
            await sleep(1000)
            start = end
        }
    }
}

run()
    .then(() => {
        console.log('Job execution complete.')
    })
    .catch(console.error)
