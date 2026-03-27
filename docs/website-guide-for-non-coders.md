# JOE Website Guide

## What This Website Is

This website is the main digital home for Jawa Offworld Enterprises.

It does several jobs at once:

- It acts as a public-facing website for visitors.
- It gives members internal tools after they log in.
- It gives admins and sysadmins control panels to manage content and data.
- It connects to SWCombine data so the site can show galaxy, payment, and reference information.

In simple terms, the site is part public website, part member portal, and part admin dashboard.

## The Main Areas of the Website

### 1. Loading Screen

When someone visits the root of the site, they first hit a loading screen.

Its job is to:

- show the branded entry experience
- check the current site state
- move the user into the main website

This helps the site feel intentional instead of dropping someone straight into a plain page.

### 2. Home

The Home area is the public front page for JOE.

It is built to explain who JOE is and what it controls.

Main things shown here:

- JOE overview
- territory information
- weather panel
- employee spotlight
- tenets of salvage
- contact information

This is the page most useful to someone who is just learning what JOE is.

### 3. JEN

JEN works like the site's news and announcement system.

You can think of it as the website's media board.

It is used for:

- news posts
- announcements
- long-form writeups
- edited content with a stronger visual layout

Admins and authorized users can create, edit, and remove JEN posts.
Regular visitors mostly use it for reading.

### 4. About Me

This page is the user's account summary.

It shows:

- who the user is
- whether their SWCombine account is linked
- what permissions they have

For a normal user, this is the quickest place to confirm:

- "Am I logged in?"
- "Is my SWC account connected?"
- "What access do I have?"

### 5. Members

The Members area is the internal tool space for logged-in users.

It currently centers around three views:

- Overview
- Jobs
- Galaxy

This is where the website stops being just informational and starts becoming operational.

#### Members Overview

This gives a quick summary of the user's current activity, especially around jobs.

#### Members Jobs

This is the internal job board.

Members can:

- view open jobs
- post jobs
- take jobs
- join jobs
- complete jobs

This makes it useful for coordination inside the group.

#### Members Galaxy

This is the member-facing map and system browser.

It lets members:

- browse sectors
- move around the galaxy map
- inspect systems
- open a dedicated system page
- view planets and stations in a system grid
- add and manage map notes on selected grid cells

This part of the website is one of the most custom tools in the whole project.

### 6. Payments

The Payments area is a workflow tool for handling SWCombine payment tasks.

It is designed to reduce manual work around credit transfers.

Main payment views:

- Pending
- Owed To Me
- History
- Manual Templates

Users can:

- build payment links
- build bulk payment lines
- verify payment transfers
- work from reusable payment templates

This section is especially useful for recurring finance work.

### 7. Admin

The Admin area is the management side of the website.

Only users with the right permissions can access it.

The Admin area includes:

- site overview
- user permissions management
- loading tips management
- tenets management
- employee spotlight management
- weather management
- action logs
- site lock controls
- system and galaxy tools
- entity stats editing

This is where staff run the website without touching the database directly.

## Important Admin Tools

### Site Lock

The website can be locked.

When locked:

- normal visitors see the locked message
- approved users can still bypass it

This is useful for maintenance, emergencies, or private work.

### Action Logs

The system records important admin actions.

This helps answer questions like:

- who changed something
- when it was changed
- what tool was used

That gives the site accountability and traceability.

### Entity Stats

This is the internal editor for stored SWCombine reference data.

Examples include:

- station types
- ship types
- facility types
- item types
- terrain types
- material types

This lets admins inspect and edit stored reference records without opening the database manually.

### System Tools

This is where the large SWCombine pullers live.

These tools can:

- pull sectors
- pull systems
- run a full background galaxy sync
- refresh stored planets
- pull full reference catalogs like station types, ship types, facilities, items, terrain, and materials

Many of these long-running tools now include heartbeat or live progress output so admins can see what is happening while they run.

## The Galaxy System in Plain English

One of the biggest custom parts of the website is the galaxy data system.

The website stores local copies of SWCombine galaxy data so people can work faster and more safely inside the site.

This includes:

- sectors
- systems
- planets
- stations
- hyperlanes
- station types
- ship types
- facility types
- item types
- terrain types
- material types

### Why Store the Data Locally

Instead of asking SWCombine for everything every time a user clicks something, the website keeps its own stored copy.

That makes it possible to:

- load pages faster
- show custom tools on top of the data
- keep notes and internal context
- run deeper analysis and admin workflows

### Full Syncs

The site can run full galaxy sync jobs in the background.

These jobs:

- work sector by sector
- save progress as they go
- show status and heartbeat information
- can resume after failures

That makes the sync system more practical for very large pulls.

### Type Catalogs

Separate pullers exist for reference catalogs such as stations, ships, facilities, items, terrain, and materials.

These are not the live objects in the galaxy.

They are the master definitions of what those things are.

That reference layer helps the site enrich the real galaxy data with better detail.

## How Login Works

The website uses Discord login for site access.

It also supports linking a user's SWCombine account.

That means the site can understand:

- who the user is on the website
- who they are in SWCombine
- what permissions they should have

Permissions control which parts of the website a person can see or use.

Examples:

- member access
- admin access
- sysadmin access
- intel access

## How the Website Is Organized Behind the Scenes

Even for a non-coder, it helps to understand the site has two major halves.

### Frontend

The frontend is the part people see and click.

It handles:

- pages
- buttons
- maps
- forms
- layouts
- interactive tools

### Backend

The backend handles the site logic and saved data.

It is responsible for:

- login
- permissions
- reading and saving records
- calling SWCombine APIs
- background jobs
- action logging

In plain terms:

- the frontend is the face
- the backend is the engine

## Who This Website Serves

This website serves several groups at the same time.

### Public Visitors

They mainly use:

- Home
- JEN
- public information pages

### Members

They mainly use:

- Members area
- Jobs
- Galaxy tools
- Payments

### Admins and Sysadmins

They mainly use:

- Admin panels
- sync tools
- logs
- data editors
- permission controls

## Why This Website Matters

This is not just a brochure site.

It is a working operations site for JOE.

It combines:

- public identity
- internal coordination
- finance support
- galaxy mapping
- SWCombine data management
- admin control

That makes it the central place where information, operations, and management come together.

## Short Summary

If someone asked, "What does this website do?" the simplest answer would be:

"It is JOE's public website, internal member portal, galaxy map, payment tool, and admin control center all in one place."
