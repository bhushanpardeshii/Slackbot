require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const PORT = process.env.PORT || 3000;

// approval-test command
app.post('/slack/commands', async (req, res) => {

    try {
        const { trigger_id, command } = req.body;

        if (command !== '/approve-test') {
            return res.status(400).send('Invalid command');
        }

        if (!trigger_id) {
            return res.status(400).send('Missing trigger_id');
        }

        // modal with dropdown and text input  
        const modal = {
            trigger_id,
            view: {
                type: "modal",
                callback_id: "approval_request",
                title: { type: "plain_text", text: "Approval Request" },
                submit: { type: "plain_text", text: "Submit" },
                close: { type: "plain_text", text: "Cancel" },
                blocks: [
                    {
                        type: "input",
                        block_id: "approver_select",
                        label: { type: "plain_text", text: "Select Approver" },
                        element: {
                            type: "users_select",
                            action_id: "approver"
                        }
                    },
                    {
                        type: "input",
                        block_id: "approval_text",
                        label: { type: "plain_text", text: "Approval Request" },
                        element: {
                            type: "plain_text_input",
                            action_id: "request_text",
                            multiline: true
                        }
                    }
                ]
            }
        };

        await axios.post('https://slack.com/api/views.open', modal, {
            headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}`, 'Content-Type': 'application/json' }
        });

        res.status(200).send();
    } catch (error) {
        console.error('Error handling slash command:', error);
        console.error('Error details:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status
        });
        res.status(500).send('Internal Server Error');
    }
});

// handling modal submission and buttons
app.post('/slack/interactions', async (req, res) => {
    const payload = JSON.parse(req.body.payload);

    if (payload.type === "view_submission" && payload.view.callback_id === "approval_request") {
        const approver = payload.view.state.values.approver_select.approver.selected_user;
        const request_text = payload.view.state.values.approval_text.request_text.value;
        const requester = payload.user.id;

        // send message to approver with approve andreject buttons
        await axios.post('https://slack.com/api/chat.postMessage', {
            channel: approver,
            text: `<@${requester}> has requested an approval:\n\n"${request_text}"`,
            blocks: [
                {
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: `<@${requester}> has requested an approval:\n\n"${request_text}"`
                    }
                },
                {
                    type: "actions",
                    elements: [
                        {
                            type: "button",
                            text: {
                                type: "plain_text",
                                text: "Approve"
                            },
                            style: "primary",
                            value: `approve_${requester}`,
                            action_id: "approve_button"
                        },
                        {
                            type: "button",
                            text: {
                                type: "plain_text",
                                text: "Reject"
                            },
                            style: "danger",
                            value: `reject_${requester}`,
                            action_id: "reject_button"
                        }
                    ]
                }
            ]
        }, {
            headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` }
        });

        res.status(200).send();
    } else if (payload.type === "block_actions") {
        const action = payload.actions[0];
        const approver = payload.user.id;
        const [action_type, requester] = action.value.split("_");
        const originalMessageTs = payload.message.ts;
        const originalChannel = payload.channel.id;

        // message to requester of approval/rejection
        const message = action_type === "approve" ?
            "Your request was approved" :
            "Your request was rejected";

        // sending message to requester
        await axios.post('https://slack.com/api/chat.postMessage', {
            channel: requester,
            text: `<@${approver}> ${message}`
        }, {
            headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` }
        });

        // notifying approver too
        const approverMessage = action_type === "approve" ?
            "You have approved the request" :
            "You have rejected the request";

        await axios.post('https://slack.com/api/chat.postMessage', {
            channel: approver,
            text: approverMessage
        }, {
            headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` }
        });

        // updating the message to remove buttons of approve and reject
        await axios.post('https://slack.com/api/chat.update', {
            channel: originalChannel,
            ts: originalMessageTs,
            text: `<@${requester}> has requested an approval:\n\n"${payload.message.text}"\n\nStatus: ${action_type === "approve" ? "Approved" : "Rejected"}`,
            blocks: [
                {
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: `<@${requester}> has requested an approval:\n\n"${payload.message.text}"\n\nStatus: ${action_type === "approve" ? "Approved" : "Rejected"}`
                    }
                }
            ]
        }, {
            headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` }
        });

        res.status(200).send();
    }
});
//to avoid running the server when the file is imported (testing purposes)
if (require.main === module) {
    app.listen(PORT, () => console.log(`bot running on port ${PORT}`));
}

module.exports = app;
