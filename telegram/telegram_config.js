const readline = require('readline');
const { MongoClient } = require('mongodb');

const {
    MONGO_DB_URL,
    MONGO_DB_BOTS_DATABASE,
    MONGO_DB_BOTS_COLLECTION_NAME
} = require('../CONSTS');

const {connect_to_mongodb_telegram} = require('../mongo_handling');

// Function to add a bot to MongoDB
async function add_bot_to_mongodb(bot) {
    const { client, collection } = await connect_to_mongodb_telegram();

    const existing_bot = await collection.findOne({ token: bot.token });
    if (!existing_bot) {
        await collection.insertOne(bot);
        console.log(`Bot '${bot.name}' added successfully.`);
    } else {
        console.log(`Bot with token '${bot.token}' already exists. Skipping.`);
    }

    await client.close();
}

// Function to remove duplicate bots by name
async function remove_duplicate_bots_by_name() {
    const { client, collection } = await connect_to_mongodb();

    // Find all bots in the collection
    const all_bots = await collection.find({}).toArray();

    // Group bots by name
    const bots_grouped_by_name = all_bots.reduce((acc, bot) => {
        acc[bot.name] = acc[bot.name] || [];
        acc[bot.name].push(bot);
        return acc;
    }, {});

    // Iterate through grouped bots and remove duplicates
    for (const [name, bots] of Object.entries(bots_grouped_by_name)) {
        if (bots.length > 1) {
            console.log(`Found duplicates for bot name: '${name}'`);

            // Keep the first bot and remove the rest
            const bots_to_remove = bots.slice(1).map(bot => bot._id);
            await collection.deleteMany({ _id: { $in: bots_to_remove } });

            console.log(`Removed ${bots_to_remove.length} duplicate(s) for bot name: '${name}'`);
        }
    }

    console.log('Duplicate removal process completed.');

    await client.close();
}

// Creates an interface for reading user input from the terminal
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Prompt for bot details
function prompt_for_bot() {
    rl.question('Enter the bot name (or type "done" to finish): ', (name) => {
        if (name.toLowerCase() === 'done') {
            rl.close();
            return;
        }
        rl.question('Enter the bot token: ', (token) => {
            rl.question('Enter the bot domain: ', async (domain) => {
                const api_url = `https://api.telegram.org/bot${token}`;
                const bot = { name, token, api_url, domain, saved_location: null };
                await add_bot_to_mongodb(bot);
                prompt_for_bot();
            });
        });
    });
}

console.log('Enter bot details. Type "done" when finished.');
prompt_for_bot();

// Remove duplicates immediately when the script runs
remove_duplicate_bots_by_name();
