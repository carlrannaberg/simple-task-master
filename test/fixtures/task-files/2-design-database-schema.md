---
schema: 1
id: 2
title: Design database schema
status: done
created: 2024-01-10T09:00:00.000Z
updated: 2024-01-12T16:45:00.000Z
tags:
  - database
  - design
  - backend
dependencies: []
---

# Database Schema Design

## Tables

### Users

- id (PRIMARY KEY)
- email (UNIQUE)
- password_hash
- created_at
- updated_at
- is_active

### Tasks

- id (PRIMARY KEY)
- user_id (FOREIGN KEY)
- title
- description
- status
- priority
- due_date
- created_at
- updated_at

### Categories

- id (PRIMARY KEY)
- name
- color
- user_id (FOREIGN KEY)

## Relationships

- Users have many Tasks
- Users have many Categories
- Tasks belong to Categories

## Indexes

- user_id on tasks table
- status on tasks table
- email on users table
