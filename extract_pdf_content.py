#!/usr/bin/env python3
"""
Extract text content from PDF file for analysis
"""

import PyPDF2
import sys
import os

def extract_pdf_text(pdf_path):
    """Extract text from PDF file"""
    try:
        with open(pdf_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            text = ""
            
            print(f"PDF has {len(pdf_reader.pages)} pages")
            
            for page_num in range(len(pdf_reader.pages)):
                page = pdf_reader.pages[page_num]
                page_text = page.extract_text()
                text += f"\n--- PAGE {page_num + 1} ---\n"
                text += page_text
                
            return text
            
    except Exception as e:
        print(f"Error reading PDF: {e}")
        return None

def main():
    pdf_path = "/home/pixel/aichat/SHG-Mangement-main/tmp/STATEMENT MAY- 2025.pdf"
    
    if not os.path.exists(pdf_path):
        print(f"PDF file not found: {pdf_path}")
        return
        
    print(f"Extracting text from: {pdf_path}")
    text = extract_pdf_text(pdf_path)
    
    if text:
        print("\n" + "="*50)
        print("PDF CONTENT:")
        print("="*50)
        print(text)
        print("="*50)
        
        # Also save to file for reference
        output_file = "/home/pixel/aichat/SHG-Mangement-main/pdf_extracted_content.txt"
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(text)
        print(f"\nContent saved to: {output_file}")
    else:
        print("Failed to extract text from PDF")

if __name__ == "__main__":
    main()
