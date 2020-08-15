const axios = require('axios').default

exports.default = {
    months: [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December'
    ],
    sleep: (ms) => {
        return new Promise(resolve => setTimeout(resolve, ms));
    },
    httpGet: async (uri) => {
        const response = await axios.get(url)
        if (response) return response.data.data
        return undefined
    }
}