/**
 * Wix and ContentEditable Support
 * Handles non-standard form elements used by Wix, Medium, etc.
 */

export interface UniversalField {
  element: HTMLInputElement | HTMLTextAreaElement | HTMLElement;
  type: 'input' | 'textarea' | 'contenteditable';
  isContentEditable: boolean;
}

export function getAllFillableFields(): UniversalField[] {
  const allFields: UniversalField[] = [];
  
  console.log('🔎 Detailed page scan:');
  
  // Check for iframes (Wix often uses these!)
  const iframes = document.querySelectorAll('iframe');
  console.log(`  🖼️ Iframes found: ${iframes.length}`);
  iframes.forEach((iframe, i) => {
    console.log(`    ${i+1}. src="${iframe.src?.substring(0, 80)}..."`);
    console.log(`       accessible: ${canAccessIframe(iframe)}`);
  });
  
  // 1. Standard HTML form fields
  const standardInputs = document.querySelectorAll('input, textarea');
  console.log(`  📝 Standard inputs/textareas in main document: ${standardInputs.length}`);
  
  standardInputs.forEach((el) => {
    const element = el as HTMLInputElement | HTMLTextAreaElement;
    
    if (element.tagName === 'TEXTAREA') {
      allFields.push({
        element,
        type: 'textarea',
        isContentEditable: false
      });
    } else if (element.tagName === 'INPUT') {
      const type = (element as HTMLInputElement).type.toLowerCase();
      if (['text', 'email', 'search', 'url', 'tel', 'password', 'number'].includes(type)) {
        allFields.push({
          element,
          type: 'input',
          isContentEditable: false
        });
      }
    }
  });
  
  // 2. ContentEditable elements (Wix!)
  const contentEditables = document.querySelectorAll('[contenteditable="true"], [contenteditable="plaintext-only"], [contenteditable=""]');
  console.log(`  ✏️ ContentEditable elements in main document: ${contentEditables.length}`);
  
  // Also check with .isContentEditable property
  const allDivs = document.querySelectorAll('div, span, p');
  let editableCount = 0;
  allDivs.forEach((div) => {
    if ((div as HTMLElement).isContentEditable) {
      editableCount++;
    }
  });
  console.log(`  ✏️ Elements with isContentEditable=true: ${editableCount}`);
  
  contentEditables.forEach((el) => {
    const element = el as HTMLElement;
    if (element.isContentEditable) {
      allFields.push({
        element,
        type: 'contenteditable',
        isContentEditable: true
      });
    }
  });
  
  // 3. Shadow DOM fields
  scanShadowDOM(document, allFields);
  
  return allFields;
}

function scanShadowDOM(root: Document | ShadowRoot, fields: UniversalField[]) {
  const allElements = root.querySelectorAll('*');
  
  allElements.forEach((el) => {
    if (el.shadowRoot) {
      // Scan inside shadow root
      const shadowInputs = el.shadowRoot.querySelectorAll('input, textarea, [contenteditable="true"]');
      
      shadowInputs.forEach((shadowEl) => {
        if (shadowEl.tagName === 'TEXTAREA') {
          fields.push({
            element: shadowEl as HTMLTextAreaElement,
            type: 'textarea',
            isContentEditable: false
          });
        } else if (shadowEl.tagName === 'INPUT') {
          const input = shadowEl as HTMLInputElement;
          const type = input.type.toLowerCase();
          if (['text', 'email', 'search', 'url', 'tel', 'password', 'number'].includes(type)) {
            fields.push({
              element: input,
              type: 'input',
              isContentEditable: false
            });
          }
        } else if ((shadowEl as HTMLElement).isContentEditable) {
          fields.push({
            element: shadowEl as HTMLElement,
            type: 'contenteditable',
            isContentEditable: true
          });
        }
      });
      
      // Recursively scan nested shadow roots
      scanShadowDOM(el.shadowRoot, fields);
    }
  });
}

export function getFieldValue(field: UniversalField): string {
  if (field.isContentEditable) {
    return field.element.textContent?.trim() || '';
  } else {
    return (field.element as HTMLInputElement | HTMLTextAreaElement).value || '';
  }
}

export function setFieldValue(field: UniversalField, value: string): void {
  if (field.isContentEditable) {
    const el = field.element as HTMLElement;
    
    // Set both textContent and innerText for compatibility
    el.textContent = value;
    el.innerText = value;
    
    // Trigger events
    el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
    
    // Wix-specific: trigger focus/blur cycle
    el.focus();
    setTimeout(() => {
      el.blur();
      el.focus();
    }, 50);
  } else {
    const el = field.element as HTMLInputElement | HTMLTextAreaElement;
    
    // Use native setter
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )?.set;
    
    const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value'
    )?.set;
    
    if (el.tagName === 'INPUT' && nativeInputValueSetter) {
      nativeInputValueSetter.call(el, value);
    } else if (el.tagName === 'TEXTAREA' && nativeTextAreaValueSetter) {
      nativeTextAreaValueSetter.call(el, value);
    } else {
      el.value = value;
    }
    
    // Trigger events
    el.dispatchEvent(new InputEvent('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

export function getFieldContext(field: UniversalField): any {
  const element = field.element;
  
  // Find label
  let labelText = '';
  
  if (element.id) {
    const label = document.querySelector(`label[for="${element.id}"]`);
    if (label) labelText = label.textContent?.trim() || '';
  }
  
  if (!labelText) {
    const parentLabel = element.closest('label');
    if (parentLabel) labelText = parentLabel.textContent?.trim() || '';
  }
  
  if (!labelText) {
    labelText = element.getAttribute('aria-label') || '';
  }
  
  // Get other attributes
  const nameAttr = (element as any).name || element.id || '';
  const placeholder = (element as any).placeholder || element.getAttribute('placeholder') || '';
  
  return {
    label_text: labelText,
    name_attr: nameAttr,
    id_attr: element.id,
    placeholder: placeholder,
    field_id: `field-${Date.now()}-${Math.random()}`,
    nearby_text: getNearbyText(element),
    max_length: (element as any).maxLength || null
  };
}

function getNearbyText(element: HTMLElement): string {
  // Get text from nearby elements
  const parent = element.parentElement;
  if (!parent) return '';
  
  const siblings = Array.from(parent.children);
  const texts = siblings
    .filter(el => el !== element && el.tagName !== 'SCRIPT' && el.tagName !== 'STYLE')
    .map(el => el.textContent?.trim())
    .filter(Boolean);
  
  return texts.join(' ').substring(0, 200);
}

function canAccessIframe(iframe: HTMLIFrameElement): boolean {
  try {
    // Try to access contentDocument
    const doc = iframe.contentDocument;
    return doc !== null;
  } catch (e) {
    return false; // Cross-origin, can't access
  }
}

