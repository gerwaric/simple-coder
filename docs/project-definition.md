# HumanLayer Take-Home Assessment

This assessment is solely for the purposes of evaluating your qualifications for a role at HumanLayer. Nothing in this assessment will be used in HumanLayer’s products and/or systems. Neither HumanLayer’s issuance of this assessment to you nor your completion of it constitute an offer of or contract for employment at HumanLayer.

The objective of this assessment is not to determine how much code you can write or how many features you can ship, and the assessment will not be evaluated on the basis of “feature completeness” against existing coding agents. Rather, we want to understand how you approach the problem and design a solution to it.

## Task

Your task is to implement a sync-based headless coding agent and user interface. The components of the system should be as follows:

### 1. Server Process

a. Runs on a web server. Manages a database (e.g. Postgres, MySQL,etc.)  
b. Provides an API for user interaction.  
c. Provides sync-driven functionality for user interface  

### 2. Headless Coding Agent / Daemon

a. Should be able to run anywhere that can connect out to the server - on a workstation,  
sandbox, container, etc.  
b. Contains the coding agent’s “agent loop” including inference API calls, state, etc.  
c. Starting it must be as simple as running a CLI command.  
d. Connects out to the server process - the server process may not initiate connections with  
the coding agent, as it may (theoretically) be running from inside of a private sandbox or  
network and not be publicly-routable  
e. Receives user-requested sessions from the server, runs the sessions on the host it’s  
running on, and streams events (tool calls, thinking tokens, assistant messages) to the  
server in live time where they are saved to the database  

### 3. User interface

a. Reactive user interface which allows the user to interact with the server over APIs for  
session creation, etc.  
b. Running sessions that are saved in the server-managed database should be synced out  
to the client in live-time so the user can see the coding agent’s work as it is working  
c. Must allow creating a session and stopping a session at minimum  

## Constraints

- Your project MUST be written entirely in TypeScript both for the frontend and for the coding agent harness/backend  
- You are free to use whatever libraries, toolchain, and packages that you would like with a few caveats:

1. You MUST NOT use the SDK of an existing coding agent (Claude Code SDK, OpenCode SDK, Amp, Cursor, etc.) as your coding agent. You may use them for inspiration, but your coding agent’s source code may not use their SDKs, binaries, or source code as direct or indirect dependencies.  
   a. Use of LLM provider SDKs or agent-building SDKs which do not give you a  
   pre-built agent (e.g. the Vercel AI SDK, Mastra, Langchain.js, and LLM provider  
   SDKs is acceptable and encouraged.  

2. Apart from an LLM API key for inference, the deliverable MUST NOT require paid  
services, platforms or dependencies  

3. You MUST NOT use Next.js  

4. Your deliverable MUST include a docker-compose configuration as described below  

- Your deliverable MAY require the end-user to configure an API key for an LLM inference provider (Anthropic, OpenAI, Google) for the coding agent to work  
  - or it may rely on locally-served models through llama.cpp or similar.  
  - Ensure you provide configuration instructions in your deliverable.  

- All your work done on the assessment MUST be tracked in your version control  

- The deliverable MUST include a docker-compose project which:  

  - which has containers for:  
    - the server process and/or UI (they may in the same or in separate containers)  
    - the database  
    - a separate container (e.g. ubuntu) which the coding agent runs inside.  

  - The server container and UI container should expose appropriate ports so a user can  
  interact with them. The container which the coding agent runs inside may not  
  expose or open any ports.  

  - A reviewer MUST be able to configure any required API keys in a .env file and run  
  docker compose up to build and run the project successfully, without any additional  
  build steps or configuration. Submissions which do not build successfully will be rejected.  

## Deliverables

Your deliverables should be contained within a publicly-accessible GitHub repository, containing:

- The full source code of your project, including the version history of your work on it through git commits  

- A README.md file at the root of the repository which contains:  

  - A brief overview of the project describing the stack, architecture, design decisions,  
  features, etc.  
    - If you include a video (see below) you may include this in the video instead  

  - Sufficient instructions for a technical reviewer to get the project up-and-running for the  
  purposes of evaluating it  
    - A docker compose file is recommended for database setup  

  - A section on which coding agent(s) you used, if any, and a brief overview of your process  
  & methodology for working with them.  

- The README should container a link to a Loom video or other web-viewable video of you  
demonstrating using the assessment project  

- If you worked with an AI coding agent on the project, you should include your configuration  
directory (e.g. `.opencode`, `.claude`, `.cursor`, etc.) and any AGENTS.md or CLAUDE.md file  
you used, skills, etc.
