
import logging
from typing import Optional, List, Dict, Tuple
from langchain_ollama import ChatOllama
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from app.models.transaction import CategoryEnum, Transaction, Category
from sqlalchemy.future import select
from sqlalchemy import distinct
from rapidfuzz import process, fuzz

# Get a logger
logger = logging.getLogger(__name__)

class AICategorizer:
    def __init__(self, model_name: str = "qwen2.5:7b", base_url: str = "http://host.docker.internal:11434"):
        """
        Initializes the AI Categorizer with LangChain and ChatOllama.
        """
        self.model_name = model_name
        self.base_url = base_url
        
        # Valid categories for the prompt
        self.valid_categories = ", ".join([f'"{e.value}"' for e in CategoryEnum])
        
        # Caching user history for few-shot prompting
        self.history_cache: List[Tuple[str, float, str]] = [] # List of (description, amount, category_name)
        
        # Initialize the LLM
        # request_timeout is helpful to avoid hanging indefinitely
        self.llm = ChatOllama(
            model=model_name,
            base_url=base_url,
            temperature=0.0, # Deterministic output
            request_timeout=10.0 # 10 seconds timeout
        )

        # Define the prompt template
        self.prompt = ChatPromptTemplate.from_messages([
            ("system", 
             "You are a financial classifier. Given the transaction description and amount, classify it into exactly ONE of these categories: "
             "[{valid_categories}]. "
             "\n\nContext from similar past transactions:\n{context}\n\n"
             "**Logic for Incomes (Salário vs Receita):**\n"
             "- Check the input Amount against the Historical Examples (if any).\n"
             "- Salaries often vary slightly (approx 5-15%) due to tax deductions/bonuses. If the description is similar to a past 'Salário' AND the amount is within a reasonable range (e.g. ±15%), classify as 'Salário'.\n"
             "- If the amount is significantly different (e.g. R$ 200 vs R$ 8000) despite similar text, or if the text suggests a generic transfer, classify as 'Receita'.\n"
             "- Explicit terms like 'Folha', 'Salário', 'Pagamento' usually indicate 'Salário', but ONLY if the amount is significant (> 1000).\n"
             "\n"
             "Prioritize the patterns found in the 'Similar past examples' above general knowledge.\n"
             "Return ONLY the category name as a string, nothing else. "
             "If you are unsure or the description is too vague, pick the best fit or 'Não Categorizado'."
            ),
            ("user", "Transaction: {description} | Amount: {amount}")
        ])

        # Create the chain
        self.chain = self.prompt | self.llm | StrOutputParser()

    async def load_history(self, db_session):
        """
        Loads distinct transaction descriptions and their assigned categories into memory.
        This serves as the knowledge base for 'Few-Shot' prompting.
        """
        try:
            # Join Transaction with Category to get the name, filter only categorized ones
            stmt = select(distinct(Transaction.description), Transaction.amount, Category.name)\
                .join(Category, Transaction.category_id == Category.id)\
                .where(Transaction.category_id.is_not(None))\
                .where(Transaction.description.is_not(None))\
                .where(Transaction.is_verified == True)
            
            result = await db_session.execute(stmt)
            rows = result.all()
            
            # Update cache: List of tuples (description, amount, category_name)
            self.history_cache = [(row[0], float(row[1]), row[2]) for row in rows if row[0]]
            logger.info(f"Categorizer memory updated with {len(self.history_cache)} examples.")
            
        except Exception as e:
            logger.error(f"Failed to load transaction history for AI memory: {e}")

    async def predict_category(self, description: str, amount: float, db=None) -> str:
        """
        Predicts the category for a given transaction asynchronously.
        Uses rapidfuzz to find similar past transactions and boosts the prompt with them.
        Returns 'Não Categorizado' if the model fails or times out.
        """
        try:
            # Lazy load history if provided DB session and cache is empty
            if db and not self.history_cache:
                await self.load_history(db)

            # 1. Find relevant context from history
            context_str = "No similar past examples found."
            if self.history_cache and description:
                # Extract only descriptions for matching
                choices = [item[0] for item in self.history_cache]
                
                # Get top 3 similar descriptions
                matches = process.extract(description, choices, limit=3, scorer=fuzz.WRatio)
                
                # Filter matches with score > 60
                good_matches = []
                for match in matches:
                    # match is (string, score, index)
                    matched_desc = match[0]
                    score = match[1]
                    index = match[2]
                    
                    if score > 60:
                         # Retrieve the category from cache using index
                         cached_item = self.history_cache[index]
                         # cached_item is (desc, amount, category_name)
                         matched_desc_db = cached_item[0]
                         matched_amount = cached_item[1]
                         category = cached_item[2]
                         
                         good_matches.append(f"- '{matched_desc_db}' (Value: {matched_amount:.2f}) was classified as '{category}'")

                if good_matches:
                    context_str = "Similar past examples: " + "; ".join(good_matches)

            # 2. Invoke the chain with context
            result = await self.chain.ainvoke({
                "valid_categories": self.valid_categories,
                "description": description,
                "amount": amount,
                "context": context_str
            })
            
            cleaned_result = result.strip().replace('"', '').replace("'", "")
            
            # Validate if the result is actually in our enum values
            # (Ollama is usually good, but being safe is better)
            allowed_values = {e.value for e in CategoryEnum}
            
            if cleaned_result in allowed_values:
                return cleaned_result
            
            # Basic fuzzy matching or fallback if LLM hallucinated
            # For now, just log and fallback if strict match fails, or maybe try to find a substring
            # But "stack" request instruction implies we trust the output mostly.
            # Let's try to see if any valid category is IN the result (e.g. if it output "Category: Moradia")
            for val in allowed_values:
                if val in cleaned_result:
                    return val
                    
            logger.warning(f"Categorizer returned invalid category '{cleaned_result}' for '{description}'. Fallback to Uncategorized.")
            return CategoryEnum.UNCATEGORIZED.value

        except Exception as e:
            logger.error(f"AI Categorization failed using {self.base_url}: {e}")
            return CategoryEnum.UNCATEGORIZED.value
