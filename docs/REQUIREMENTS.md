Here is the complete document converted into clean Markdown format:

## 1. Overview

You are asked to design, build, and deploy an **AI-powered analytics dashboard** for a logistics client.

This assignment evaluates your ability to:

- Build a full-stack application
- Work with structured data
- Design meaningful analytics
- Integrate AI responsibly
- Implement forecasting
- Deploy a production-ready system
- Communicate technical decisions clearly

---

## 2. Project Summary

Build a web application that allows users to explore logistics data through:

- A **traditional analytics dashboard** (KPIs + charts)
- A **natural-language interface powered by AI**

The system should support:

- Querying operational data
- Generating charts dynamically
- Answering business questions
- Predicting demand

---

## 3. Core Concept

The application must use **one unified dataset** and support three levels of intelligence:

### 3.1 Descriptive Analytics

- Dashboards and visualizations that show what has happened

### 3.2 Diagnostic Analytics

- Natural-language queries answered directly from data – explaining why

### 3.3 Predictive & Prescriptive Analytics

- Forecasting future demand and recommending action

---

## 4. Core Requirements

### 4.1 Dashboard

Create a dashboard for a logistics client.

**Minimum KPIs:**

- Total orders
- Delivered orders
- Delayed orders
- On-time delivery rate
- Average delivery time

**Minimum Charts (at least 2):**

- Order volume over time
- Delivery performance (delayed vs on-time)
- Carrier or destination breakdown

### 4.2 Natural Language Queries

Users must be able to ask questions such as:

- _“Show delayed orders by week for the last 3 months”_
- _“Which carrier has the highest delay rate?”_
- _“How many orders were delivered late last month?”_

The system should:

1. Interpret the question
2. Retrieve relevant data
3. Return:

- A direct answer
- A chart
- Or both

### 4.3 Dynamic Chart Generation

The system must:

- Automatically select an appropriate chart type
- Render charts dynamically
- Support a subset of analytical queries

### 4.4 Explainability

For every answer or chart, include:

- Filters used (e.g., time range)
- Metrics and dimensions
- Query plan or structured interpretation (recommended)
- Access to underlying data (table or summary)

### 4.5 Data Handling

- Use the provided dataset or database
- Treat all data as read-only
- Ensure correct aggregation and filtering

---

## 5. AI-Orchestrated Analytical Tools

The AI layer must act as a routing and orchestration system, not as the source of truth.

> **Key Principle:**
> AI should interpret the user’s question, select the correct computation path, call the appropriate tool, and present results clearly. AI must **NOT** generate answers without computation.

### 5.1 Required Analytical Tools

#### A. Query Tool (Analytics)

- **Used for:** Dashboard queries, aggregations, KPI calculations
- **Examples:**
- _“Show delayed orders by week”_
- _“Which carrier has the highest delay rate?”_

#### B. Forecasting Tool

- **Used for:** Predicting future demand
- **Examples:**
- _“Predict demand for SKU X for the next 4 months”_
- _“How much inventory should I plan?”_

- **Requirements:**
- Use historical dataset data
- Apply a basic forecasting method
- Return:
- Forecast values
- Visualization (historical + forecast)
- Inventory recommendation
- Explanation of methodology

- **Acceptable methods:** Moving average, linear regression, exponential smoothing, or simple trend models.

### 5.2 Expected System Flow

$$\text{User Question} \longrightarrow \text{AI Interpretation} \longrightarrow \text{Tool Selection} \longrightarrow \text{Structured Input} \longrightarrow \text{Computation} \longrightarrow \text{Result} \longrightarrow \text{Explanation} \longrightarrow \text{Visualization}$$

---

## 6. Deployment Requirements

Your application must:

- Be deployed to a publicly accessible URL
- Be fully usable without local setup
- Be stable and functional for reviewers

If authentication is used:

- Provide test credentials

> **Notes:**
>
> - You may use any platform (e.g., Vercel, AWS).
> - Do **NOT** commit secrets to the repository.

---

## 8. Technical Expectations

You may use any technology stack.

**Examples (optional):**

- **Frontend:** React / Next.js / Vue
- **Backend:** Node / Python / Java / .NET
- **Database:** PostgreSQL

---

## 9. Architecture Guidelines

- Avoid executing raw AI-generated SQL without validation.
- Prefer structured query generation.
- Clearly separate:
- AI interpretation
- Data computation
- Business logic

---

## 10. Deliverables

You must submit:

1. Source code repository
2. Live deployed application URL
3. `README.md`

---

## 11. README Requirements

Your `README.md` must include:

- **Setup:** Local setup instructions & environment variables
- **Architecture:** System overview, key design decisions, & data flow
- **AI Approach:** How questions are interpreted & how tools are selected
- **Assumptions:** Simplifications made
- **Limitations:** Unsupported features or queries
- **Future Improvements:** What you would build next

---

## 12. Time Expectation

- **Expected effort:** 6–10 hours
- **We value:** Clarity, correctness, and reasoning **over** completeness and polish.

---

## 13. Evaluation Criteria

| Category               | Weight |
| ---------------------- | ------ |
| Product & UX           | 15%    |
| Frontend               | 15%    |
| Backend & Architecture | 20%    |
| Data Correctness       | 20%    |
| AI Orchestration       | 15%    |
| Forecasting            | 10%    |
| Deployment             | 5%     |

---

## 14. Bonus (Optional)

- Query history
- Caching
- Tests
- Docker setup
- Advanced explainability
- Handling ambiguous queries

---

## 15. Important Notes

- Do **NOT** over-engineer.
- Prefer simple, correct solutions.
- Clearly explain tradeoffs.
- Undisclosed AI usage may be treated negatively.

---

## 16. Submission

Provide:

- Repository link
- Deployed app URL
- Credentials (if required)

---

## 17. What We’re Evaluating

We are evaluating your ability to:

- Build a real product
- Reason about data
- Design intelligent systems
- Use AI responsibly
- Communicate clearly
