
import logging
from typing import Optional
from langchain_ollama import ChatOllama
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from app.models.transaction import CategoryEnum

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
             "For positive amounts (Income): Classify as 'Salário' ONLY if the description explicitly mentions salary terms (e.g., 'Pagamento Salário', 'Folha', 'Bsys', 'Contabilizei'). For all other inflows (Pix received, refunds, transfers), classify as 'Receita'. "
             "Return ONLY the category name as a string, nothing else. "
             "If you are unsure or the description is too vague, pick the best fit or 'Não Categorizado'."
            ),
            ("user", "Transaction: {description} | Amount: {amount}")
        ])

        # Create the chain
        self.chain = self.prompt | self.llm | StrOutputParser()

    async def predict_category(self, description: str, amount: float) -> str:
        """
        Predicts the category for a given transaction asynchronously.
        Returns 'Não Categorizado' if the model fails or times out.
        """
        try:
            category_cleanup = CategoryEnum.UNCATEGORIZED.value
            
            # Invoke the chain
            result = await self.chain.ainvoke({
                "valid_categories": self.valid_categories,
                "description": description,
                "amount": amount
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
