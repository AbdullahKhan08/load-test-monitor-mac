// uiDialogs.js
function cAlert(
  message,
  {
    title = 'Alert',
    okText = 'OK',
    variant = 'primary',
    headerVariant = 'primary',
  } = {}
) {
  return new Promise((resolve) => {
    showModal({
      title,
      message,
      headerVariant,
      buttons: [{ text: okText, variant: variant, value: true }],
      resolve,
    })
  })
}

function cConfirm(
  message,
  {
    title = 'Confirm',
    okText = 'Yes',
    cancelText = 'Cancel',
    okVariant = 'danger',
    headerVariant = 'danger',
  } = {}
) {
  return new Promise((resolve) => {
    showModal({
      title,
      message,
      headerVariant,
      buttons: [
        { text: cancelText, variant: 'ghost', value: false },
        { text: okText, variant: okVariant, value: true },
      ],
      resolve,
    })
  })
}

/* ---------------- internals ---------------- */

function showModal({ title, message, headerVariant, buttons, resolve }) {
  const root = ensureRoot()
  const overlay = document.createElement('div')
  overlay.className = 'cmodal__overlay'
  overlay.tabIndex = -1 // to receive focus for escape

  const modal = document.createElement('div') //   modal.className = 'cmodal'
  modal.className = `cmodal cmodal--${headerVariant || 'primary'}`
  modal.setAttribute('role', 'dialog')
  modal.setAttribute('aria-modal', 'true')
  modal.setAttribute('aria-labelledby', 'cmodal-title')

  modal.innerHTML = `
      <div class="cmodal__header" id="cmodal-title">${title}</div>
      <div class="cmodal__body">${escapeHtml(String(message))}</div>
      <div class="cmodal__footer"></div>
    `

  const footer = modal.querySelector('.cmodal__footer')

  const clickHandler = (val) => {
    cleanup()
    resolve(val)
  }

  buttons.forEach((b, index) => {
    const btn = document.createElement('button')
    btn.className = `cmodal__btn ${
      b.variant ? `cmodal__btn--${b.variant}` : 'cmodal__btn--primary'
    }`
    btn.textContent = b.text
    btn.addEventListener('click', () => clickHandler(b.value))
    footer.appendChild(btn)

    if (index === buttons.length - 1) {
      setTimeout(() => btn.focus(), 0) // focus primary/last
    }
  })

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      // Click outside closes only if you want it to, here we do nothing.
    }
  })

  const escHandler = (e) => {
    if (e.key === 'Escape') {
      clickHandler(false)
    }
    if (e.key === 'Enter') {
      // press default (last) button
      const primary = footer.querySelector('button:last-child')
      if (primary) primary.click()
    }
  }

  function cleanup() {
    window.removeEventListener('keydown', escHandler, true)
    overlay.remove()
    // restore focus to the previously focused element if needed
    if (lastActive && lastActive.focus) {
      lastActive.focus()
    }
  }

  root.appendChild(overlay)
  overlay.appendChild(modal)

  const lastActive = document.activeElement
  window.addEventListener('keydown', escHandler, true)
}

function ensureRoot() {
  let root = document.getElementById('modal-root')
  if (!root) {
    root = document.createElement('div')
    root.id = 'modal-root'
    document.body.appendChild(root)
  }
  return root
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

module.exports = { cAlert, cConfirm }
