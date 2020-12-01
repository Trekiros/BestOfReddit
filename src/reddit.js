const Snoowrap = require('snoowrap');
const { httpGet, sleep } = require('./util').default


exports.default = async (credentials) => {
    const snoowrap = await new Snoowrap({
        ...credentials,
        userAgent: 'BestOfReddit:1.0.0 (https://github.com/Trekiros/BestOfReddit)'
    })

    return {
        getTopPosts: async (subredditConf, startDate, endDate, limit) => {
            const { name: subredditName, exclude: excludeTerms } = subredditConf
            let latest = startDate.valueOf()/1000
            const top = []

            /*
                This service follows the method described here:
                https://www.reddit.com/r/pushshift/comments/bcxguf/new_to_pushshift_read_this_faq/

                1. Retrieve all content in that date range
                2. Get updated scores from reddit for those items
                3. Sort the results yourself
            */

            const PAGE_SIZE = 100
            let resultsLength = PAGE_SIZE
            do {
                // 1. Retrieve all content in that date range using Pushshift
                const query = 'https://api.pushshift.io/reddit/search/submission/?metadata=true'
                    + ((excludeTerms && excludeTerms.length) ? `&q=${excludeTerms.map(term => `-"${term}`).join(' ')}"` : '')
                    + `&after=${latest}`
                    + `&before=${endDate.valueOf()/1000}`
                    + `&subreddit=${subredditName}`
                    + `&limit=${PAGE_SIZE}`
                const response = await httpGet(query)
                resultsLength = response.length

                // 2. Get updated scores for those items using the reddit client
                for (let i = 0 ; i < response.length ; i++) {
                    const redditPost = response[i]
                    
                    const start = Date.now()
                    const score = await snoowrap.getSubmission(redditPost.id).score
                    const end = Date.now()

                    // Rate limit: 60 requests per minute, or 1 request per second
                    // Plus 50ms just in case, to ensure the limit is never hit
                    if (end - start < 1050) {
                        await sleep(end-start + 50) 
                    }

                    
                    if (latest < redditPost.created_utc) {
                        latest = redditPost.created_utc
                    }
    
                    // 3. Sort these results
                    top.push({ redditPost, score })
                    top.sort((post1, post2) => post2.score - post1.score)
                    if (top.length > limit) {
                        top.pop()
                    }
                }

                console.log(resultsLength, 'posts retrieved. Current top scores:', top.map(post => post.score).join(', '))
            } while ((resultsLength === PAGE_SIZE) && (latest < endDate.valueOf()/1000))


            return top.map(entry => entry.redditPost)
        }
    }
}