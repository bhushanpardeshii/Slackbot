// Import required packages
const request = require('supertest');
const axios = require('axios');

// to avoid making real api calls during testing
jest.mock('axios');

process.env.SLACK_BOT_TOKEN = 'test-token';
process.env.PORT = 3000;

const app = require('./index');


describe('slack bot tests', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    // test 1-check if approval-test command works
    test('slash command opens modal', async () => {
        // mocking slack api response
        axios.post.mockResolvedValue({ data: { ok: true } });

        const response = await request(app)
            .post('/slack/commands')
            .send({
                command: '/approve-test',
                trigger_id: 'test123'
            });


        expect(response.status).toBe(200);

        // check if we called the Slack API correctly
        expect(axios.post).toHaveBeenCalledWith(
            'https://slack.com/api/views.open',
            expect.objectContaining({
                trigger_id: 'test123',
                view: expect.objectContaining({
                    type: 'modal',
                    title: { type: 'plain_text', text: 'Approval Request' }
                })
            }),
            expect.any(Object)
        );
    });

    // test 2-check if request is sent correctly
    test('sends request to approver', async () => {

        axios.post.mockResolvedValue({ data: { ok: true } });

        // creating test data that looks like a real one
        const testData = {
            type: 'view_submission',
            view: {
                callback_id: 'approval_request',
                state: {
                    values: {
                        approver_select: {
                            approver: {
                                selected_user: 'U123'
                            }
                        },
                        approval_text: {
                            request_text: {
                                value: 'need approval for xyz'
                            }
                        }
                    }
                }
            },
            user: {
                id: 'U456'
            }
        };

        // send the test data to our endpoint
        const response = await request(app)
            .post('/slack/interactions')
            .send({ payload: JSON.stringify(testData) });


        expect(response.status).toBe(200);

        // checking if we sent the message correctly
        expect(axios.post).toHaveBeenCalledWith(
            'https://slack.com/api/chat.postMessage',
            expect.objectContaining({
                channel: 'U123',
                text: expect.stringContaining('U456'),
                blocks: expect.arrayContaining([
                    expect.objectContaining({
                        type: 'section',
                        text: expect.objectContaining({
                            type: 'mrkdwn',
                            text: expect.stringContaining('need approval for xyz')
                        })
                    })
                ])
            }),
            expect.any(Object)
        );
    });

    // test 3-checking if approval decision updates the message
    test('updates message after approval', async () => {

        axios.post.mockResolvedValue({ data: { ok: true } });

        // creating test data for an approval 
        const testData = {
            type: 'block_actions',
            actions: [{
                value: 'approve_U123',
                action_id: 'approve_button'
            }],
            user: {
                id: 'U456'
            },
            message: {
                ts: '123456.789',
                text: 'Original request'
            },
            channel: {
                id: 'C123'
            }
        };


        const response = await request(app)
            .post('/slack/interactions')
            .send({ payload: JSON.stringify(testData) });


        expect(response.status).toBe(200);

        // checking if we made all the imp API calls
        expect(axios.post).toHaveBeenCalledTimes(3);

        // checking if we updated the original message correctly
        expect(axios.post).toHaveBeenCalledWith(
            'https://slack.com/api/chat.update',
            expect.objectContaining({
                channel: 'C123',
                ts: '123456.789',
                text: expect.stringContaining('Approved')
            }),
            expect.any(Object)
        );
    });
}); 