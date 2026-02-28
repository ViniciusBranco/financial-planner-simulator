import polars as pl
import re
import uuid
import hashlib
from decimal import Decimal
from datetime import date, datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.transaction import Transaction, TransactionType, Category, CategoryEnum
from app.services.categorizer import AICategorizer

def parse_currency(value: Any) -> Optional[Decimal]:
    """
    Parses currency string like 'R$ 1.200,50' to Decimal.
    Returns None if empty or invalid.
    """
    if value is None or (isinstance(value, float) and value != value) or value == '' or value == '-':
        return None
    
    if isinstance(value, (int, float)):
        return Decimal(value)
        
    str_val = str(value).strip()
    
    # Sanitize using Regex: Keep only digits, minus (-), and comma (,)
    # This removes 'R$', '.', spaces, non-breaking spaces, etc.
    # Example: "-R$ 3.655,34" -> "-3655,34"
    clean_val = re.sub(r'[^\d,-]', '', str_val)

    if not clean_val:
        return None
        
    # Handle Brazilian format: Replace decimal comma with dot
    # Example: "-3655,34" -> "-3655.34"
    clean_val = clean_val.replace(',', '.')
    
    try:
        return Decimal(clean_val)
    except:
        return None

def parse_date(date_str: Any) -> Optional[date]:
    """
    Parses DD/MM/YYYY or DD/MM/YY (plus time) to date object.
    Handles '28/11/25 às 11:09:43'.
    """
    if date_str is None or (isinstance(date_str, float) and date_str != date_str):
        return None
        
    s = str(date_str).strip()
    
    # Cleaning: remove " às ..." or " HH:MM:SS"
    if " às " in s:
        s = s.split(" às ")[0]
    elif " " in s:
        s = s.split(" ")[0]
        
    # Remove potentially invisible chars
    s = "".join(s.split())

    try:
        # Try DD/MM/YYYY
        return datetime.strptime(s, "%d/%m/%Y").date()
    except ValueError:
        pass
        
    try:
        # Try DD/MM/YY
        return datetime.strptime(s, "%d/%m/%y").date()
    except ValueError:
        return None

def parse_installments(description: str) -> Tuple[Optional[str], Optional[int], Optional[int]]:
    """
    Extracts description, installment number and total from string like "Purchase Description 01/10".
    Returns (cleaned_description, current, total).
    
    Actually, usually XP puts "Purchase Name - Parcela X de Y" or similar, 
    but sometimes it is in a separate column "Parcela".
    The user task says: 'Parse "X de Y" column.' implies a specific column named "Parcela".
    """
    return description, None, None

def parse_installment_column(val: Any) -> Tuple[Optional[int], Optional[int]]:
    """
    Parses string "1 de 10" or "01/12" to (1, 10).
    """
    if val is None or (isinstance(val, float) and val != val):
        return None, None
    s = str(val).strip().lower()
    
    # Matches "1 de 10" or "1/10"
    match = re.search(r"(\d+)\s*(?:de|/)\s*(\d+)", s)
    if match:
        return int(match.group(1)), int(match.group(2))
    
    # Just a number "1" -> (1, 1)? No, usually implies 1/1 if single.
    if s.isdigit():
        return 1, 1
        
    return None, None

async def import_transactions_from_file(file_obj: Any, filename: str, session: AsyncSession, override_reference_date: Optional[date] = None) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Reads the CSV and extracts detailed line-item transactions.
    Supports XP Credit Card and XP Bank Account formats.
    """
    # Check for duplicate file import
    try:
        stmt = select(Transaction).where(Transaction.raw_data['source_filename'].astext == filename).limit(1)
        result = await session.execute(stmt)
        if result.scalar_one_or_none():
            raise Exception(f"File '{filename}' has already been imported.")
    except Exception as e:
        # If any DB error (e.g. malformed json), just log and proceed or raise? 
        # Better raise to be safe, but 'astext' requires PG. 
        # Assuming PG.
        if "already imported" in str(e): raise e
        print(f"Warning: Could not check filename duplication: {e}")

    try:
        # Read with ; delimiter
        df = pl.read_csv(file_obj, separator=';', ignore_errors=True)
    except Exception as e:
        print(f"Error reading CSV: {e}")
        return [], []

    # Detect Type
    columns = [c.strip() for c in df.columns]
    
    is_xp_card = 'Portador' in columns and 'Parcela' in columns
    is_xp_account = 'Saldo' in columns and 'Descricao' in columns 
    # Let's normalize columns to be safe
    df = df.rename({c: c.strip() for c in df.columns})
    
    # Check again
    if 'Portador' in df.columns and 'Parcela' in df.columns:
        return await process_xp_card(df, filename, session, override_reference_date)
    elif 'Saldo' in df.columns and 'Descrição' in df.columns: 
         return await process_xp_account(df, filename, session, override_reference_date)
    elif 'Saldo' in df.columns and 'Descricao' in df.columns: 
         return await process_xp_account(df, filename, session, override_reference_date)
    
    # Check for "Lancamento" or "Lançamento" which is common in account statements
    if 'Data' in df.columns and ('Lançamento' in df.columns or 'Lancamento' in df.columns) and 'Valor' in df.columns:
         return await process_xp_account(df, filename, session, override_reference_date)

    print(f"Unknown CSV format. Columns: {df.columns}")
    return [], []

async def process_xp_card(df: pl.DataFrame, filename: str, session: AsyncSession, override_reference_date: Optional[date] = None) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Process XP Credit Card CSV.
    Columns expected: Data, Estabelecimento, Portador, Valor, Parcela...
    """
    extracted = []
    
    # Initialize Categorizer
    categorizer = AICategorizer()
    await categorizer.load_history(session)
    
    # Pre-fetch categories map to avoid N+1 queries if possible, or query on the fly. 
    # For now, let's query on the fly or maybe better, fetch all categories to a dict?
    # Fetching all categories is safer and faster.
    stmt_cats = select(Category)
    res_cats = await session.execute(stmt_cats)
    all_categories = {c.name: c.id for c in res_cats.scalars().all()}

    for idx, row in enumerate(df.to_dicts()):
        try:
            # Parse Amount
            raw_amount = parse_currency(row.get('Valor'))
            if raw_amount is None:
                continue

            # Polarity Inversion for CARD
            if raw_amount > 0:
                amount = -raw_amount
                tx_type = TransactionType.EXPENSE
            else:
                amount = abs(raw_amount)
                tx_type = TransactionType.INCOME # Default, might check payment below
            
            # Date
            tx_date = parse_date(row.get('Data'))
            if not tx_date:
                continue
            
            # Determine Reference Date
            reference_date = override_reference_date or tx_date.replace(day=1)

            # Description
            description = str(row.get('Estabelecimento', '')).strip()
            
            # Payment of invoice in Card view is a Transfer (Credit)
            if "pagamento de fatura" in description.lower():
                tx_type = TransactionType.TRANSFER
            
            # Cardholder
            cardholder = str(row.get('Portador', '')).strip()
            
            # Installments
            inst_str = str(row.get('Parcela', ''))
            curr_inst, total_inst = parse_installment_column(inst_str)
            
            # Category
            # AI Categorization Logic
            predicted_category_name = None
            category_id = None
            
            # Use AI to predict category
            try:
                # We prioritize the amount magnitude for context, but pass descriptive amount
                predicted_category_name = await categorizer.predict_category(description, float(amount))
                
                # Resolve ID
                if predicted_category_name in all_categories:
                    category_id = all_categories[predicted_category_name]
                else:
                    # Fallback if AI gave a valid enum string but it's somehow not in DB (shouldn't happen due to seed)
                    # Or check for 'Não Categorizado'
                    if predicted_category_name == CategoryEnum.UNCATEGORIZED.value:
                         category_id = all_categories.get(CategoryEnum.UNCATEGORIZED.value)
                    else:
                         # Try finding UNCAT
                         category_id = all_categories.get(CategoryEnum.UNCATEGORIZED.value)
            
            except Exception as e:
                print(f"AI Categorization error (ignoring): {e}")
                category_id = all_categories.get(CategoryEnum.UNCATEGORIZED.value)
            
            extracted.append({
                "date": tx_date,
                "description": description,
                "amount": amount,
                "type": tx_type,
                "cardholder": cardholder,
                "installment_current": curr_inst,
                "installment_total": total_inst,
                "source_type": "XP_CARD",
                "category_id": category_id,
                "category_legacy": predicted_category_name or "Uncategorized", 
                "manual_tag": predicted_category_name, # Storing AI prediction here for reference
                "is_recurring": (total_inst is not None and total_inst > 1),
                "reference_date": reference_date,
                "raw_data": {"source_filename": filename}
            })
            
        except Exception as e:
            print(f"Error parsing card row {idx}: {e}")
            continue

    return await persist_transactions(session, extracted)

async def process_xp_account(df: pl.DataFrame, filename: str, session: AsyncSession, override_reference_date: Optional[date] = None) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Process XP Bank Account CSV.
    Columns expected: Data, Lançamento (or Descrição), Valor, Saldo...
    """
    extracted = []
    
    # Identify Description column
    desc_col = 'Descrição' if 'Descrição' in df.columns else 'Descricao'
    if desc_col not in df.columns and 'Lançamento' in df.columns:
        desc_col = 'Lançamento'
    if desc_col not in df.columns and 'Lancamento' in df.columns:
        desc_col = 'Lancamento'

    # Initialize Categorizer
    categorizer = AICategorizer()
    await categorizer.load_history(session)
    
    # Pre-fetch categories map to avoid N+1 queries if possible, or query on the fly. 
    # For now, let's query on the fly or maybe better, fetch all categories to a dict?
    # Fetching all categories is safer and faster.
    stmt_cats = select(Category)
    res_cats = await session.execute(stmt_cats)
    all_categories = {c.name: c.id for c in res_cats.scalars().all()}

    for idx, row in enumerate(df.to_dicts()):
        try:
            # Parse Amount
            val_col = 'Valor'
            raw_amount = parse_currency(row.get(val_col))
            if raw_amount is None:
                continue
            
            # Polarity
            if raw_amount >= 0:
                amount = raw_amount
                tx_type = TransactionType.INCOME
            else:
                amount = raw_amount # Store negative?
                tx_type = TransactionType.EXPENSE
            
            # Date
            tx_date = parse_date(row.get('Data'))
            if not tx_date:
                continue
                
            # Determine Reference Date
            reference_date = override_reference_date or tx_date.replace(day=1)

            # Description
            description = str(row.get(desc_col, '')).strip()

            # Detect Transfer
            if "pagamento de fatura" in description.lower():
                tx_type = TransactionType.TRANSFER
            
            # AI Categorization Logic
            predicted_category_name = None
            category_id = None
            
            try:
                predicted_category_name = await categorizer.predict_category(description, float(amount))
                 # Resolve ID
                if predicted_category_name in all_categories:
                    category_id = all_categories[predicted_category_name]
                else:
                     category_id = all_categories.get(CategoryEnum.UNCATEGORIZED.value)
            except Exception as e:
                print(f"AI Categorization error (ignoring): {e}")
                category_id = all_categories.get(CategoryEnum.UNCATEGORIZED.value)

            extracted.append({
                "date": tx_date,
                "description": description,
                "amount": amount,
                "type": tx_type,
                "source_type": "XP_ACCOUNT",
                "category_id": category_id,
                "category_legacy": predicted_category_name or "Uncategorized",
                "manual_tag": predicted_category_name,
                "is_recurring": False,
                "reference_date": reference_date,
                "raw_data": {"source_filename": filename}
            })
            
        except Exception as e:
            print(f"Error parsing account row {idx}: {e}")
            continue
            
    return await persist_transactions(session, extracted)

def generate_transaction_hash(entry: Dict[str, Any]) -> str:
    """
    Generates a deterministic hash for checking duplicates.
    Hash = sha256(date + amount + description + source_type + source_filename)
       
    The user requested: sha256(date + description + amount + source_id)
    We'll use source_type as part of source_id.
    """
    # Normalize data for hashing
    d_str = str(entry.get('date', ''))
    amt_str = str(entry.get('amount', ''))
    desc_str = str(entry.get('description', '')).strip()
    src_str = str(entry.get('source_type', ''))
    
    # We create the raw string
    raw = f"{d_str}{amt_str}{desc_str}{src_str}"
    
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()

async def persist_transactions(session: AsyncSession, transactions: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Deduplicates and saves transactions.
    Returns (saved_transactions, reconciliation_candidates)
    """
    saved = []
    candidates = []
    
    # 1. Compute Hashes with Intra-Batch Counter
    # (To handle legitimate duplicates within the same file)
    batch_hashes_counter = {} # hash_base -> count
    entries_to_check = []
    
    for tx in transactions:
        base_hash = generate_transaction_hash(tx)
        
        current_count = batch_hashes_counter.get(base_hash, 0)
        unique_hash = f"{base_hash}_{current_count}"
        
        batch_hashes_counter[base_hash] = current_count + 1
        
        tx['unique_hash'] = unique_hash
        entries_to_check.append(tx)
        
    if not entries_to_check:
        return [], []
        
    # 2. Check Database for Existing Hashes
    unique_hashes = [tx['unique_hash'] for tx in entries_to_check]
    
    # We query for any of these hashes already existing.
    # We use chunks to avoid hitting parameter limits if batch is huge (though usually it's small).
    # For now, simplistic approach.
    existing_hashes = set()
    
    # Chunking just in case (Postgres limit ~32k or 65k params)
    chunk_size = 1000
    for i in range(0, len(unique_hashes), chunk_size):
        chunk = unique_hashes[i:i + chunk_size]
        stmt_check = select(Transaction.unique_hash).where(Transaction.unique_hash.in_(chunk))
        result_check = await session.execute(stmt_check)
        existing_hashes.update(result_check.scalars().all())
    
    for tx_data in entries_to_check:
        if tx_data['unique_hash'] in existing_hashes:
            # Skip duplicate
            continue
            
        # Auto-Reconciliation Logic
        # Check for matching MANUAL transaction
        target_amount = tx_data['amount']
        target_date = tx_data['date']
        
        # Define tolerance window
        start_date = target_date - timedelta(days=2)
        end_date = target_date + timedelta(days=2)
        
        stmt = select(Transaction).where(
            Transaction.source_type == 'MANUAL',
            Transaction.amount == target_amount,
            Transaction.date >= start_date,
            Transaction.date <= end_date
        ).limit(1)
        
        result = await session.execute(stmt)
        match = result.scalars().first()
        
        if match:
             candidates.append({
                 "id": str(match.id),
                 "date": match.date,
                 "description": match.description,
                 "amount": match.amount,
                 "type": match.type,
                 "category_legacy": match.category_legacy
             })
             # Do NOT delete automatically in this version
        
        new_tx = Transaction(**tx_data)
        session.add(new_tx)
        saved.append(tx_data)
    
    await session.commit()
    return saved, candidates
