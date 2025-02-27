import logging
from typing import List, Dict, Tuple, Any
import json
import traceback
from app.services.llm_factory import LLMFactory

logger = logging.getLogger(__name__)

# Store single LLM instance at module level
_llm = None

def set_llm(llm: Any) -> None:
    """Set the LLM instance to be used by the tools.
    
    Args:
        llm (Any): The LLM wrapper instance to use
    """
    global _llm
    _llm = llm




def check_nsf(input_text: str) -> str:
    """Check for NSF (Non-Sufficient Funds) fees and incidents. Returns JSON response."""
    prompt = """You are a JSON-only response bot. Analyze ALL bank statements for NSF (Non-Sufficient Funds) fees across the ENTIRE date range. Do not consider any fees that are not NSF fees (like overdraft fees).
    
You must ONLY return a valid JSON object in this exact format, with no additional text or explanation:

{
    "nsf_incidents": [
        {
            "date": "YYYY-MM-DD",
            "amount": fee_amount        
        }
    ],
    "total_fees": total_amount,
    "incident_count": number_of_incidents
}

IMPORTANT:
1. Check ALL months in the statements, not just the first month
2. Look for NSF fees across the entire date range
3. Include ALL incidents found in ANY month
4. All dates must be in YYYY-MM-DD format
5. All amounts must be numbers (not strings)
6. Round all amounts to 2 decimal places
7. Verify you've checked all statements before responding
8. Ensure the JSON is valid and properly formatted"""

    try:
        logger.info("🔧 Tool check_nsf called")
        response = _llm.get_response(prompt=prompt)
        
        logger.info("Raw response received:")
        logger.info("-" * 50)
        logger.info(response)
        logger.info("-" * 50)
        
        if not response:
            logger.error("Received empty response from LLM")
            raise ValueError("Empty response from LLM")
            
        # Clean the response
        cleaned_response = response.strip()
        
        # Remove markdown and language indicators
        if "```" in cleaned_response:
            parts = cleaned_response.split("```")
            if len(parts) >= 3:
                cleaned_response = parts[1]
                if cleaned_response.startswith("json"):
                    cleaned_response = cleaned_response[4:].strip()
        
        logger.info("Cleaned response:")
        logger.info(cleaned_response)
        
        # Validate JSON
        try:
            data = json.loads(cleaned_response)
            
            # Validate required fields
            required_fields = ['nsf_incidents', 'total_fees', 'incident_count']
            for field in required_fields:
                if field not in data:
                    raise ValueError(f"Missing required field: {field}")
            
            # Validate incident data
            for incident in data['nsf_incidents']:
                required_incident_fields = ['date', 'amount']
                for field in required_incident_fields:
                    if field not in incident:
                        raise ValueError(f"Missing field {field} in NSF incident")
            
            logger.info(f"Successfully parsed JSON with {len(data['nsf_incidents'])} incidents")
            logger.info(f"Total fees: ${data['total_fees']:,.2f}")
            logger.info(f"Incident count: {data['incident_count']}")
            
            return cleaned_response
            
        except json.JSONDecodeError as e:
            logger.error(f"JSON parsing error: {str(e)}")
            logger.error(f"Attempted to parse: {cleaned_response}")
            raise ValueError(f"Invalid JSON response: {str(e)}")
            
    except Exception as e:
        logger.error(f"Tool error: {str(e)}")
        logger.error(f"Full traceback:\n{traceback.format_exc()}")
        return json.dumps({
            "error": str(e),
            "nsf_incidents": [],
            "total_fees": 0,
            "incident_count": 0
        })


def check_statement_continuity(input_text: str) -> str:
    """
    Check if bank statements are contiguous (sequential months with no gaps).
    Returns JSON string with analysis results.
    """
    prompt = """You are a JSON-only response bot. THOROUGHLY analyze ALL bank statements to identify date ranges covered.
    
    You must ONLY return a valid JSON object in this exact format, with no additional text or explanation:

    {
        "statement_periods": [
            {
                "start_date": "YYYY-MM-DD",
                "end_date": "YYYY-MM-DD"
            }
        ],
        "analysis": {
            "is_contiguous": boolean,
            "gap_details": ["Gap found between YYYY-MM-DD and YYYY-MM-DD"],
            "explanation": "Detailed explanation of why statements are not contiguous, or 'Statements are contiguous' if no gaps"
        }
    }

    CRITICAL RULES:
    1. Return ONLY valid JSON - no extra text
    2. IMPORTANT: You MUST check EVERY page of EVERY statement thoroughly
    3. DO NOT skip any pages or statements
    4. Search for ALL month headers, dates, and period indicators
    5. Common statement indicators to look for:
       - "Statement Period: MM/DD to MM/DD"
       - "Statement Dates: MM/DD/YYYY - MM/DD/YYYY"
       - Monthly headers showing statement month
       - Date ranges at top or bottom of statements
    6. After finding ALL periods:
       - Sort them by start_date
       - Check for gaps between sorted periods
       - Month transitions (like July 31 to August 1) are NOT gaps
    7. VERIFY before responding:
       - Have you checked every page?
       - Did you find all month headers?
       - Are all statement periods accounted for?
    8. If you find any mention of September, October, or any month:
       - You MUST include it in the periods list
       - Double-check start and end dates
    9. DO NOT assume months are missing without thorough verification
    10. If you're unsure about a period, include it and note in explanation"""

    try:
        logger.info("🔧 Tool check_statement_continuity called")
        response = _llm.get_response(prompt=prompt)
        
        logger.info("Raw response received:")
        logger.info("-" * 50)
        logger.info(response)
        logger.info("-" * 50)
        
        if not response:
            logger.error("Received empty response from LLM")
            raise ValueError("Empty response from LLM")
            
        # Clean the response
        cleaned_response = response.strip()
        
        # Remove markdown and language indicators
        if "```" in cleaned_response:
            parts = cleaned_response.split("```")
            if len(parts) >= 3:
                cleaned_response = parts[1]
                if cleaned_response.startswith("json"):
                    cleaned_response = cleaned_response[4:].strip()
        
        logger.info("Cleaned response:")
        logger.info(cleaned_response)
        
        # Validate JSON
        try:
            data = json.loads(cleaned_response)
            
            # Validate required fields
            if 'statement_periods' not in data or 'analysis' not in data:
                raise ValueError("Missing required fields: statement_periods or analysis")
                
            if 'is_contiguous' not in data['analysis']:
                raise ValueError("Missing is_contiguous in analysis")
            
            logger.info(f"Successfully parsed JSON with {len(data['statement_periods'])} periods")
            logger.info(f"Is contiguous: {data['analysis']['is_contiguous']}")
            
            # Add explanation validation
            if 'explanation' not in data['analysis']:
                raise ValueError("Missing required field: analysis.explanation")
            
            logger.info(f"Continuity explanation: {data['analysis']['explanation']}")
            
            return cleaned_response
            
        except json.JSONDecodeError as e:
            logger.error(f"JSON parsing error: {str(e)}")
            logger.error(f"Attempted to parse: {cleaned_response}")
            raise ValueError(f"Invalid JSON response: {str(e)}")
            
    except Exception as e:
        logger.error(f"Tool error: {str(e)}")
        logger.error(f"Full traceback:\n{traceback.format_exc()}")
        return json.dumps({
            "statement_periods": [],
            "analysis": {
                "is_contiguous": False,
                "gap_details": [f"Error analyzing continuity: {str(e)}"],
                "explanation": f"Error during analysis: {str(e)}"
            }
        })


def extract_daily_balances(input_text: str) -> str:
    """Extract or calculate daily balances from bank statements. Returns JSON response."""
    
    try:
        # Parse input_text as JSON to get continuity data
        input_data = json.loads(input_text) if input_text != "None" else {}
        continuity_data = input_data.get("continuity_data", {})
        
        if not continuity_data:
            logger.error("No continuity data provided")
            return json.dumps({"daily_balances": []})
        
        periods = continuity_data.get("statement_periods", [])
        if not periods:
            logger.error("No statement periods found in continuity data")
            return json.dumps({"daily_balances": []})
        
        # Sort periods to ensure chronological order
        periods.sort(key=lambda x: x['start_date'])
        
        # Process statements in chunks of 2 months
        all_balances = []
        
        for i in range(0, len(periods), 2):
            chunk_periods = periods[i:i+2]
            chunk_start = chunk_periods[0]['start_date']
            chunk_end = chunk_periods[-1]['end_date']
            
            logger.info(f"Processing chunk from {chunk_start} to {chunk_end}")
            
            chunk_prompt = f"""You are a JSON-only response bot. Extract daily balances for the period from {chunk_start} to {chunk_end}.

            CRITICAL RULES FOR BALANCE TYPES:
            1. "direct" balances:
               - Use ONLY when the exact balance is directly stated in the statement
               - Typically found at statement start/end dates
               - Found in "Ending Balance", "Beginning Balance", or "Balance Forward" entries
               - These are the ACTUAL balances from the bank statement
            
            2. "calculated" balances:
               - Use ONLY when a direct balance is NOT available
               - Must be calculated from transactions
               - Should be less common than direct balances
               - Only use when you need to fill gaps between direct balances

            Return ONLY a valid JSON object in this exact format:
            {{
                "daily_balances": [
                    {{
                        "date": "YYYY-MM-DD",
                        "balance": amount,
                        "is_business_day": boolean,
                        "balance_type": "direct" or "calculated"
                    }}
                ]
            }}

            IMPORTANT: 
            - Prefer "direct" balances whenever possible
            - Only use "calculated" when you must fill gaps
            - Extract ALL daily balances between {chunk_start} and {chunk_end}
            """

            try:
                chunk_response = _llm.get_response(prompt=chunk_prompt)
                
            
                # Clean the response
                cleaned_response = chunk_response.strip()
                if "```json" in cleaned_response:
                    cleaned_response = cleaned_response.split("```json")[1]
                if "```" in cleaned_response:
                    cleaned_response = cleaned_response.split("```")[0]
                cleaned_response = cleaned_response.strip()
                
                logger.info("Cleaned chunk response:")
                logger.info(cleaned_response)
                
                chunk_data = json.loads(cleaned_response)
                all_balances.extend(chunk_data.get("daily_balances", []))
                
            except Exception as e:
                logger.error(f"Error processing chunk {chunk_start} to {chunk_end}: {str(e)}")
                logger.error(f"Raw response was: {chunk_response}")
                logger.error(f"Full traceback:\n{traceback.format_exc()}")
        
        # Sort all balances by date
        all_balances.sort(key=lambda x: x['date'])
        
        # Remove any duplicates
        seen_dates = set()
        unique_balances = []
        for balance in all_balances:
            if balance['date'] not in seen_dates:
                seen_dates.add(balance['date'])
                unique_balances.append(balance)
        
        return json.dumps({"daily_balances": unique_balances})
        
    except Exception as e:
        logger.error(f"Error in extract_daily_balances: {str(e)}")
        logger.error(f"Full traceback:\n{traceback.format_exc()}")
        return json.dumps({"daily_balances": []})


def analyze_monthly_financials(input_str: str = "None") -> str:
    """Analyzes monthly expenses and revenues from bank statements, providing statistical analysis."""
    try:
        prompt = """You are a JSON-only response bot. Based on the bank statements, please provide:
        1. Monthly breakdown of expenses, revenues, and cashflow
        2. Statistical analysis including standard deviation and averages
        
        Format your response as a JSON with this structure:
        {
            "monthly_data": {
                "YYYY-MM": {
                    "expenses": total_expenses,
                    "revenue": total_revenue,
                    "cashflow": revenue_minus_expenses
                }
            },
            "statistics": {
                "revenue": {
                    "average": avg_monthly_revenue,
                    "std_deviation": revenue_std_dev
                },
                "expenses": {
                    "average": avg_monthly_expenses,
                    "std_deviation": expenses_std_dev
                },
                "cashflow": {
                    "average": avg_monthly_cashflow,
                    "std_deviation": cashflow_std_dev
                }
            }
        }
        
        IMPORTANT:
        - Calculate cashflow as (revenue - expenses) for each month
        - All amounts should be numbers (not strings)
        - Round all amounts to 2 decimal places
        - Include ALL months found in statements
        - Ensure the JSON is valid and properly formatted
        
        Include only the JSON in your response, no additional text."""

        logger.info("🔄 Calling LLM for monthly financials analysis")
        response = _llm.get_response(prompt)
        
        logger.info("Raw response from LLM:")
        logger.info("-" * 50)
        logger.info(response)
        logger.info("-" * 50)
        
        # Clean the response
        cleaned_response = response.strip()
        if "```json" in cleaned_response:
            cleaned_response = cleaned_response.split("```json")[1]
        if "```" in cleaned_response:
            cleaned_response = cleaned_response.split("```")[0]
        cleaned_response = cleaned_response.strip()
        
        logger.info("Cleaned response:")
        logger.info("-" * 50)
        logger.info(cleaned_response)
        logger.info("-" * 50)
        
        # Validate JSON format
        try:
            json_response = json.loads(cleaned_response)
            
            # Validate required fields and structure
            if "monthly_data" not in json_response or "statistics" not in json_response:
                raise ValueError("Missing required top-level fields")
                
            for month, data in json_response["monthly_data"].items():
                if not all(k in data for k in ["expenses", "revenue", "cashflow"]):
                    raise ValueError(f"Missing required fields in monthly data for {month}")
                    
            for metric in ["revenue", "expenses", "cashflow"]:
                if not all(k in json_response["statistics"][metric] for k in ["average", "std_deviation"]):
                    raise ValueError(f"Missing required fields in statistics for {metric}")
            
            logger.info("✅ Successfully parsed and validated JSON response")
            return json.dumps(json_response, indent=2)
            
        except json.JSONDecodeError as e:
            logger.error(f"❌ JSON parsing error: {str(e)}")
            logger.error(f"Failed to parse response: {cleaned_response}")
            return json.dumps({
                "error": "Failed to parse financial analysis",
                "details": f"Invalid JSON format in response: {str(e)}"
            })
        except ValueError as e:
            logger.error(f"❌ Validation error: {str(e)}")
            return json.dumps({
                "error": "Failed to validate financial analysis",
                "details": str(e)
            })

    except Exception as e:
        logger.error(f"❌ Error in analyze_monthly_financials: {str(e)}")
        logger.error(f"Full traceback:\n{traceback.format_exc()}")
        return json.dumps({
            "error": "Failed to analyze financials",
            "details": str(e)
        })


def extract_monthly_closing_balances(input_str: str = "None") -> str:
    """Extract closing balances for each month from bank statements."""
    try:
        prompt = """You are a JSON-only response bot. Extract the closing balance for each month from the bank statements.

        CRITICAL RULES FOR BALANCE TYPES:
        1. "direct" balances:
           - Use ONLY when the closing balance is explicitly stated in the statement
           - Look for terms like "Ending Balance", "Closing Balance", "Statement End Balance"
           - Must be the ACTUAL balance stated for the last day of the month
           - These are directly from the bank statement
           - Often found at the bottom of monthly statements
        
        2. "calculated" balances:
           - Use ONLY when a direct closing balance is NOT available
           - Calculation steps:
             a. Start with the previous month's ending balance
             b. Add all deposits/credits in chronological order by transaction date
             c. Subtract all withdrawals/debits in chronological order by transaction date
             d. Continue until the last transaction of the month
             e. The final number is your calculated closing balance
           - Must account for ALL transactions in chronological order
           - Pay attention to transaction dates, not posting dates
           - Double-check your math - amounts should match statement totals
        
        VERIFICATION STEPS:
        1. For each month:
           - First look for an explicit ending balance statement
           - If not found, use the calculation method
           - Cross-reference with next month's opening balance
           - Verify all transactions are included
        
        2. Common places to find direct balances:
           - Bottom of statement summary
           - End of transaction list
           - Next month's opening balance
           - Daily balance summary sections
        
        Format your response as a JSON with this structure:
        {
            "monthly_closing_balances": [
                {
                    "month": "YYYY-MM",
                    "closing_date": "YYYY-MM-DD",
                    "balance": amount,
                    "balance_type": "direct" or "calculated",
                    "source": "Ending Balance statement" or "Calculated from transactions",
                    "verification": "Matches next month opening balance" or "Calculated from all transactions"
                }
            ],
            "analysis": {
                "months_covered": number_of_months,
                "direct_balances": number_of_direct,
                "calculated_balances": number_of_calculated,
                "verification_notes": ["Any discrepancies or important notes about the calculations"]
            }
        }
        
        IMPORTANT:
        - List balances for ALL months in the statements
        - Balance must be from the LAST DAY of each month
        - All amounts must be numbers (not strings)
        - Round all amounts to 2 decimal places
        - Sort entries by month chronologically
        - Clearly indicate if balance was direct or calculated
        - Include detailed source information for audit purposes
        - Add verification notes if calculated balance differs from next month's opening
        
        Include only the JSON in your response, no additional text."""

        logger.info("🔄 Calling LLM for monthly closing balances")
        response = _llm.get_response(prompt)
        
        logger.info("Raw response from LLM:")
        logger.info("-" * 50)
        logger.info(response)
        logger.info("-" * 50)
        
        # Clean the response
        cleaned_response = response.strip()
        if "```json" in cleaned_response:
            cleaned_response = cleaned_response.split("```json")[1]
        if "```" in cleaned_response:
            cleaned_response = cleaned_response.split("```")[0]
        cleaned_response = cleaned_response.strip()
        
        logger.info("Cleaned response:")
        logger.info("-" * 50)
        logger.info(cleaned_response)
        logger.info("-" * 50)
        
        # Validate JSON format
        try:
            json_response = json.loads(cleaned_response)
            
            # Validate required fields and structure
            if "monthly_closing_balances" not in json_response or "analysis" not in json_response:
                raise ValueError("Missing required top-level fields")
            
            # Validate each monthly balance entry
            for entry in json_response["monthly_closing_balances"]:
                required_fields = ["month", "closing_date", "balance", "balance_type", "source", "verification"]
                if not all(k in entry for k in required_fields):
                    raise ValueError(f"Missing required fields in entry for {entry.get('month', 'unknown month')}")
                if entry["balance_type"] not in ["direct", "calculated"]:
                    raise ValueError(f"Invalid balance_type for {entry['month']}")
            
            # Validate analysis section
            required_analysis = ["months_covered", "direct_balances", "calculated_balances", "verification_notes"]
            if not all(k in json_response["analysis"] for k in required_analysis):
                raise ValueError("Missing required analysis fields")
            
            logger.info("✅ Successfully parsed and validated JSON response")
            return json.dumps(json_response, indent=2)
            
        except json.JSONDecodeError as e:
            logger.error(f"❌ JSON parsing error: {str(e)}")
            logger.error(f"Failed to parse response: {cleaned_response}")
            return json.dumps({
                "error": "Failed to parse closing balances",
                "details": f"Invalid JSON format in response: {str(e)}"
            })
        except ValueError as e:
            logger.error(f"❌ Validation error: {str(e)}")
            return json.dumps({
                "error": "Failed to validate closing balances",
                "details": str(e)
            })

    except Exception as e:
        logger.error(f"❌ Error in extract_monthly_closing_balances: {str(e)}")
        logger.error(f"Full traceback:\n{traceback.format_exc()}")
        return json.dumps({
            "error": "Failed to extract closing balances",
            "details": str(e)
        })


def analyze_credit_decision_term_loan(debug=False):
    """Analyzes financial data to make a credit decision for a term loan. Returns JSON response."""
    try:
        prompt = """You are a **conservative commercial loan underwriter** analyzing detailed financial and bank statement data to decide whether a business qualifies for a term loan. Your objective is to produce a final JSON output **only**, following the exact structure below (no extra text or commentary). 

### CRITICAL JSON FORMATTING RULES:
1. All numeric values MUST be plain numbers WITHOUT commas
2. Example: Use 35760.90 instead of 35,760.90
3. All numbers should be valid JSON numbers (no quotes around numbers)
4. Round all monetary amounts to 2 decimal places
5. Return ONLY valid parseable JSON

### 1. Loan Parameters to Evaluate
- **Term**: 12 months
- **Payment Frequency**: Monthly
- **Annual Interest Rate**: 19% (assume a standard amortized calculation unless specified otherwise)

### 2. Analysis Scope & Priorities
You must analyze the following aspects of the business's financial health:

1. **Cash Flow Adequacy for Monthly Payments**  
   - Ensure the business can handle the proposed monthly payment without jeopardizing operations.
   - Check that average daily balances, average monthly inflows, and net cash flow trends are sufficient to cover the new payment(s).

2. **Existing Cash Balances (Liquidity Reserves)**  
   - Evaluate the business's **current and historical** cash balances as a potential safety net for repayment.  
   - Consider whether consistently high balances can offset narrower monthly net cash flows.  
   - Be explicit if the historical average or month-end balances provide a comfortable buffer to cover short-term repayment obligations.

3. **Bank Statement Analysis & Trends**  
   - Evaluate daily balances for spikes or dips, and identify any patterns (e.g., seasonal fluctuations).
   - Determine whether balances are increasing, stable, or declining over time.

4. **NSF/Overdraft Risk Indicators**  
   - Identify the presence and frequency of Non-Sufficient Funds (NSF) or overdrafts.
   - Incorporate these findings into the risk assessment.

5. **Statement Continuity & Completeness**  
   - Confirm that the provided statements cover consecutive months without missing data.
   - Missing statements or gaps could indicate data omissions or irregularities.

6. **Overall Financial Health Indicators**  
   - Examine monthly revenue vs. expenses to see if the business consistently generates positive net cash flow.
   - Look at variance or standard deviation in revenue and expenses to gauge consistency.
   - Identify whether negative cash flow months are occasional or frequent.

7. **Post-Loan Cash Flow Adequacy**  
   - Project if the business can still cover its normal operating expenses **after** introducing the new monthly payment.
   - A recommended benchmark is a **minimum 2× monthly payment coverage** from net cash flow **or** from a combination of net cash flow plus adequate existing balances.

### 3. Calculation & Decision Guidelines

1. **Coverage Ratio Requirement**  
   - Apply a conservative coverage ratio: business net cash flow / monthly payment should be at least **1.2** (1.2x coverage).  
   - **However**, if net cash flow alone doesn't meet the threshold, but the business has **consistently high cash balances** that can serve as a buffer, incorporate these balances to help fulfill the coverage requirement.  
   - You may, for example, treat 20 percent of the month-end balance as addition to business net cash flow if the business has historically maintained that minimum.

2. **Existing Cash Reserves Assessment**  
   - If monthly net cash flow is low or negative, but average daily balances over the data period are consistently well above the monthly payment, note that as a mitigating factor.  
   - Factor in how many months of loan payments could be covered solely by existing balances, in case of revenue shortfalls.

3. **Average Daily Balance Trend**  
   - Categorize as `"increasing"`, `"stable"`, or `"decreasing"`.  
   - Even one or two large deposits might not offset a generally declining trend. Use your best judgment.

4. **NSF Handling**  
   - If NSFs or overdrafts exist, incorporate them into risk factors.  
   - Consider their frequency and recency.

5. **Seasonal Patterns**  
   - Identify if certain months are typically lower in revenue or have higher expenses.  
   - This can affect the recommended maximum loan amount, even if the business has large reserves.

6. **Deriving Maximum Loan & Payment**  
   - **Compute a feasible monthly payment** that meets or exceeds your coverage ratio requirement.  
   - If net cash flow + partial draw on existing balances is still insufficient, reduce the monthly payment.  
   - **Back-calculate** the maximum principal (loan amount) using the 19% annual rate over 12 months.  
   - If the business cannot meet coverage requirements, even considering the balances, recommend a denial or a more conservative loan structure.

7. **Confidence Score**  
   - Provide a numeric score between 0.0 and 1.0 reflecting how confident you are in the approval decision, based on data completeness, financial stability, and available cash reserves.

8. **Approval Decision**  
   - `true` or `false`, reflecting whether you would approve the loan under conservative guidelines.

9. **Risk Factors & Mitigating Factors**  
   - List the major risks (e.g., inconsistent monthly cash flow, any NSFs, large expense spikes).  
   - List any mitigating factors (e.g., stable deposit patterns, strong existing balances, no NSFs).

10. **Conditions if Approved**  
   - Any special stipulations (e.g., maintain certain balance, provide updated statements, or ensure no new NSF incidents).

11. **Detailed Analysis**  
    - Provide a summary analysis of the business's financial health, including the key metrics and any mitigating or risk factors. Also mention in this section if you got the source data passed to you or not. this is to check if the data was actually fed to you or not.
Return ONLY a valid JSON object in this exact format, with no additional text:
{
    "loan_recommendation": {
        "approval_decision": boolean,
        "confidence_score": float between 0 and 1,
        "max_monthly_payment_amount": float,
        "max_loan_amount": float,
        "key_metrics": {
            "payment_coverage_ratio": float,
            "average_daily_balance_trend": "increasing|stable|decreasing",
            "lowest_monthly_balance": float,
            "highest_nsf_month_count": integer
        },
        "risk_factors": ["list of risk factors found"],
        "mitigating_factors": ["list of positive factors found"],
        "detailed_analysis": "brief analysis summary",
        "conditions_if_approved": ["list of conditions if approved"]
    }
}"""

        logger.info("🔄 Calling LLM for credit analysis")
        response = _llm.get_response(prompt)
        
        # Log the raw response for debugging
        logger.info("Raw LLM response:")
        logger.info("-" * 50)
        logger.info(response)
        logger.info("-" * 50)

        # First check if response is empty or None
        if not response:
            logger.warning("Received empty response from LLM")
            return {
                "credit_analysis": {
                    "loan_recommendation": {
                        "approval_decision": "PENDING",
                        "confidence_score": 0,
                        "max_loan_amount": 0,
                        "max_monthly_payment_amount": 0,
                        "detailed_analysis": "Unable to generate analysis at this time. Please try again.",
                        "mitigating_factors": [],
                        "risk_factors": ["Analysis temporarily unavailable"],
                        "conditions_if_approved": [],
                        "key_metrics": {
                            "payment_coverage_ratio": 0,
                            "average_daily_balance_trend": "N/A",
                            "lowest_monthly_balance": 0,
                            "highest_nsf_month_count": 0
                        }
                    }
                }
            }

        # Clean the response if it's wrapped in markdown code blocks
        cleaned_response = response.strip()
        if "```json" in cleaned_response:
            cleaned_response = cleaned_response.split("```json")[1]
        if "```" in cleaned_response:
            cleaned_response = cleaned_response.split("```")[0]
        cleaned_response = cleaned_response.strip()
        
        # Log the cleaned response for debugging
        logger.info("Cleaned response:")
        logger.info("-" * 50)
        logger.info(cleaned_response)
        logger.info("-" * 50)
            
        try:
            analysis_result = json.loads(cleaned_response)
            
            # Get the recommendation part
            if "loan_recommendation" in analysis_result:
                recommendation = analysis_result["loan_recommendation"]
            else:
                recommendation = analysis_result
            
            # Add product-specific information
            enhanced_recommendation = {
                "product_type": "term_loan",
                "product_name": "Term Loan",
                "product_details": {
                    "term_months": 12,
                    "payment_frequency": "monthly",
                    "annual_interest_rate": 19
                },
                # Include all existing fields
                "approval_decision": recommendation.get("approval_decision", False),
                "confidence_score": recommendation.get("confidence_score", 0),
                "max_loan_amount": recommendation.get("max_loan_amount", 0),
                "max_monthly_payment_amount": recommendation.get("max_monthly_payment_amount", 0),
                "detailed_analysis": recommendation.get("detailed_analysis", ""),
                "mitigating_factors": recommendation.get("mitigating_factors", []),
                "risk_factors": recommendation.get("risk_factors", []),
                "conditions_if_approved": recommendation.get("conditions_if_approved", []),
                "key_metrics": recommendation.get("key_metrics", {
                    "payment_coverage_ratio": 0,
                    "average_daily_balance_trend": "N/A",
                    "lowest_monthly_balance": 0,
                    "highest_nsf_month_count": 0
                })
            }
            
            return {
                "credit_analysis": {
                    "loan_recommendation": enhanced_recommendation
                }
            }

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM response as JSON: {e}")
            logger.error(f"Raw response: {response}")
            return {
                "credit_analysis": {
                    "loan_recommendation": {
                        "product_type": "term_loan",
                        "product_name": "Term Loan",
                        "product_details": {
                            "term_months": 12,
                            "payment_frequency": "monthly",
                            "annual_interest_rate": 19
                        },
                        "approval_decision": "ERROR",
                        "confidence_score": 0,
                        "max_loan_amount": 0,
                        "max_monthly_payment_amount": 0,
                        "detailed_analysis": "Failed to parse analysis results",
                        "mitigating_factors": [],
                        "risk_factors": ["Analysis parsing error"],
                        "conditions_if_approved": [],
                        "key_metrics": {
                            "payment_coverage_ratio": 0,
                            "average_daily_balance_trend": "N/A",
                            "lowest_monthly_balance": 0,
                            "highest_nsf_month_count": 0
                        }
                    }
                }
            }

    except Exception as e:
        logger.error(f"Error in analyze_credit_decision_term_loan: {str(e)}")
        logger.error("Full traceback:", exc_info=True)
        return {
            "credit_analysis": {
                "loan_recommendation": {
                    "product_type": "term_loan",
                    "product_name": "Term Loan",
                    "product_details": {
                        "term_months": 12,
                        "payment_frequency": "monthly",
                        "annual_interest_rate": 19
                    },
                    "approval_decision": "ERROR",
                    "confidence_score": 0,
                    "max_loan_amount": 0,
                    "max_monthly_payment_amount": 0,
                    "detailed_analysis": f"An error occurred during analysis: {str(e)}",
                    "mitigating_factors": [],
                    "risk_factors": ["Analysis error occurred"],
                    "conditions_if_approved": [],
                    "key_metrics": {
                        "payment_coverage_ratio": 0,
                        "average_daily_balance_trend": "N/A",
                        "lowest_monthly_balance": 0,
                        "highest_nsf_month_count": 0
                    }
                }
            }
        }


def analyze_credit_decision_accounts_payable(debug=False):
    """Analyzes financial data to make a credit decision for accounts payable financing. Returns JSON response."""
    try:
        prompt = """You are a **conservative commercial underwriter** analyzing detailed financial and bank statement data to decide whether a business qualifies for **accounts payable financing**. Under this program:

- The business is granted a **limit** (up to $X).  
- They may finance invoices/purchases up to that limit.  
- Each disbursement is **net of fees** (there is **no recurring interest**).  
- The **repayment** is a single ("bullet") payment of **the principal borrowed plus a transaction fee** at maturity.  
- The maturity date can be up to **90 days** from each draw date (choose 30, 60, or 90 as appropriate).

### CRITICAL JSON FORMATTING RULES:
1. All numeric values MUST be plain numbers WITHOUT commas  
2. Example: Use 35760.90 instead of 35,760.90  
3. All numbers should be valid JSON numbers (no quotes around numbers)  
4. Round all monetary amounts to 2 decimal places  
5. Return ONLY valid parseable JSON  

### 1. Financing Parameters to Evaluate
- **Limit**: Up to $X  
- **Term for Each Draw**: Up to 90 days (30, 60, or 90)  
- **Repayment Structure**: Single ("bullet") repayment of principal + transaction fee  
- **Transaction Fee**: A one-time fee (no ongoing interest)

### 2. Analysis Scope & Priorities

1. **Cash Flow Adequacy for Final Payment(s)**  
   - Ensure the business can handle one or more lump-sum repayments (principal + fee) without jeopardizing operations.  
   - Check average daily balances, monthly inflows, and net cash flow trends.

2. **Existing Cash Balances (Liquidity Reserves)**  
   - Review current and historical balances to see if they can reliably cover principal + transaction fees.  
   - Determine if the balances are consistently high enough to handle multiple or larger draws.

3. **Bank Statement Analysis & Trends**  
   - Evaluate daily balance fluctuations and patterns (seasonal peaks or dips).  
   - Determine if balances are increasing, stable, or declining over time.

4. **NSF/Overdraft Risk Indicators**  
   - Identify any Non-Sufficient Funds (NSF) incidents or overdrafts.  
   - Factor in their frequency and recency.

5. **Statement Continuity & Completeness**  
   - Confirm that consecutive months or relevant periods are provided without gaps.  
   - Missing statements could indicate data omissions or irregularities.

6. **Overall Financial Health Indicators**  
   - Look at monthly revenue vs. expenses. Are they positive, stable, or volatile?  
   - Note if negative cash flow months are occasional or frequent.

7. **Post-Financing Cash Flow Adequacy**  
   - Determine if the business can still cover its normal operating expenses **after** repaying the financed draws.  
   - A recommended benchmark is that net cash flow plus existing balances can handle the lump-sum obligations while maintaining at least 1.2× coverage of principal + fees.

### 3. Calculation & Decision Guidelines

1. **Coverage Ratio Requirement**  
   - Use a conservative coverage ratio:  
     [net cash flow over the financing period + prudent portion of existing balances] / [total principal + transaction fees] ≥ 1.2
   - If net cash flow alone doesn't meet the threshold, but there are **consistently high** cash balances, consider a prudent portion of those balances (e.g. 20%) to bridge the gap.

2. **Existing Cash Reserves Assessment**  
   - If inflows are not consistently sufficient, determine if daily/weekly balances can cover the bullet payments.  
   - Calculate how many times over the largest possible draw could be covered by those balances.

3. **Average Daily Balance Trend**  
   - Categorize as "increasing", "stable", or "decreasing" based on bank statements.  

4. **NSF Handling**  
   - Consider the presence and frequency of NSFs or overdrafts in determining risk.

5. **Seasonal Patterns**  
   - Identify any short-term dips that could coincide with repayment dates.

6. **Deriving Maximum Financing Limit & Feasible Bullet Payment**  
   - Propose a suitable limit (up to $X) and maximum draw amounts that meet coverage requirements.  
   - Factor in the single transaction fee for each draw.  
   - If coverage is not met, recommend a lower limit or denial.

7. **Confidence Score**  
   - Provide a numeric score between 0.0 and 1.0 reflecting your overall confidence in the approval decision.

8. **Approval Decision**  
   - true or false, indicating whether to approve the financing request under conservative guidelines.

9. **Risk Factors & Mitigating Factors**  
   - List major risks (e.g., frequent NSFs, negative net cash flow).  
   - Note mitigating factors (e.g., strong balances, consistent revenues).

10. **Conditions if Approved**  
    - Any stipulations required (e.g., maintain a minimum balance, provide updated statements periodically).

11. **Detailed Analysis**  
    - Summarize the business's financial health, including whether source data was actually provided.

Return ONLY a valid JSON object in this exact format, with no additional text:
        {
            "loan_recommendation": {
                "approval_decision": boolean,
        "confidence_score": float between 0 and 1,
                "max_monthly_payment_amount": float,
                "max_loan_amount": float,
                "key_metrics": {
                    "payment_coverage_ratio": float,
                    "average_daily_balance_trend": "increasing|stable|decreasing",
                    "lowest_monthly_balance": float,
                    "highest_nsf_month_count": integer
                },
        "risk_factors": ["list of risk factors found"],
        "mitigating_factors": ["list of positive factors found"],
        "detailed_analysis": "brief analysis summary",
        "conditions_if_approved": ["list of conditions if approved"]
            }
        }"""

        logger.info("🔄 Calling LLM for accounts payable credit analysis")
        response = _llm.get_response(prompt)
        
        # Log the raw response for debugging
        logger.info("Raw LLM response:")
        logger.info("-" * 50)
        logger.info(response)
        logger.info("-" * 50)

        # First check if response is empty or None
        if not response:
            logger.warning("Received empty response from LLM")
            return {
                "credit_analysis": {
                    "loan_recommendation": {
                        "approval_decision": "PENDING",
                        "confidence_score": 0,
                        "max_loan_amount": 0,
                        "max_monthly_payment_amount": 0,
                        "detailed_analysis": "Unable to generate accounts payable analysis at this time. Please try again.",
                        "mitigating_factors": [],
                        "risk_factors": ["Analysis temporarily unavailable"],
                        "conditions_if_approved": [],
                        "key_metrics": {
                            "payment_coverage_ratio": 0,
                            "average_daily_balance_trend": "N/A",
                            "lowest_monthly_balance": 0,
                            "highest_nsf_month_count": 0
                        }
                    }
                }
            }

        # Clean the response if it's wrapped in markdown code blocks
        cleaned_response = response.strip()
        if "```json" in cleaned_response:
            cleaned_response = cleaned_response.split("```json")[1]
        if "```" in cleaned_response:
            cleaned_response = cleaned_response.split("```")[0]
        cleaned_response = cleaned_response.strip()
        
        # Log the cleaned response for debugging
        logger.info("Cleaned response:")
        logger.info("-" * 50)
        logger.info(cleaned_response)
        logger.info("-" * 50)
            
        try:
            analysis_result = json.loads(cleaned_response)
            
            # Get the recommendation part
            if "loan_recommendation" in analysis_result:
                recommendation = analysis_result["loan_recommendation"]
            else:
                recommendation = analysis_result
            
            # Add product-specific information
            enhanced_recommendation = {
                "product_type": "accounts_payable",
                "product_name": "Accounts Payable Financing",
                "product_details": {
                    "max_term_days": 90,
                    "payment_type": "bullet",
                    "fee_structure": "transaction_fee"
                },
                # Include all existing fields
                "approval_decision": recommendation.get("approval_decision", False),
                "confidence_score": recommendation.get("confidence_score", 0),
                "max_loan_amount": recommendation.get("max_loan_amount", 0),
                "max_monthly_payment_amount": recommendation.get("max_monthly_payment_amount", 0),
                "detailed_analysis": recommendation.get("detailed_analysis", ""),
                "mitigating_factors": recommendation.get("mitigating_factors", []),
                "risk_factors": recommendation.get("risk_factors", []),
                "conditions_if_approved": recommendation.get("conditions_if_approved", []),
                "key_metrics": recommendation.get("key_metrics", {
                    "payment_coverage_ratio": 0,
                    "average_daily_balance_trend": "N/A",
                    "lowest_monthly_balance": 0,
                    "highest_nsf_month_count": 0
                })
            }
            
            return {
                "credit_analysis": {
                    "loan_recommendation": enhanced_recommendation
                }
            }
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM response as JSON: {e}")
            logger.error(f"Raw response: {response}")
            return {
                "credit_analysis": {
                    "loan_recommendation": {
                        "product_type": "accounts_payable",
                        "product_name": "Accounts Payable Financing",
                        "product_details": {
                            "max_term_days": 90,
                            "payment_type": "bullet",
                            "fee_structure": "transaction_fee"
                        },
                        "approval_decision": "ERROR",
                        "confidence_score": 0,
                        "max_loan_amount": 0,
                        "max_monthly_payment_amount": 0,
                        "detailed_analysis": "Failed to parse accounts payable analysis results",
                        "mitigating_factors": [],
                        "risk_factors": ["Analysis parsing error"],
                        "conditions_if_approved": [],
                        "key_metrics": {
                            "payment_coverage_ratio": 0,
                            "average_daily_balance_trend": "N/A",
                            "lowest_monthly_balance": 0,
                            "highest_nsf_month_count": 0
                        }
                    }
                }
            }

    except Exception as e:
        logger.error(f"Error in analyze_credit_decision_accounts_payable: {str(e)}")
        logger.error("Full traceback:", exc_info=True)
        return {
            "credit_analysis": {
                "loan_recommendation": {
                    "product_type": "accounts_payable",
                    "product_name": "Accounts Payable Financing",
                    "product_details": {
                        "max_term_days": 90,
                        "payment_type": "bullet",
                        "fee_structure": "transaction_fee"
                    },
                    "approval_decision": "ERROR",
                    "confidence_score": 0,
                    "max_loan_amount": 0,
                    "max_monthly_payment_amount": 0,
                    "detailed_analysis": f"An error occurred during accounts payable analysis: {str(e)}",
                    "mitigating_factors": [],
                    "risk_factors": ["Analysis error occurred"],
                    "conditions_if_approved": [],
                    "key_metrics": {
                        "payment_coverage_ratio": 0,
                        "average_daily_balance_trend": "N/A",
                        "lowest_monthly_balance": 0,
                        "highest_nsf_month_count": 0
                    }
                }
            }
        } 