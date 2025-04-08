# 📝 Slack Approval Bot

A simple Slack bot built using Node.js and Express.js that allows users (requesters) to create approval requests for other users (approvers) inside a Slack workspace. Approvers can approve or reject directly within Slack.

---

## 🚀 Features

- Slash command `/approval-test` to trigger approval flow
- Opens a modal with:
  - Dropdown to select approver
  - Text area to describe the request
- Approver receives the request with **Approve** and **Reject** buttons
- Requester gets notified based on the approver's response

---

## 🛠 Tech Stack

- Node.js
- Express.js
- Slack Web API
- ngrok (for local development)
