export const STATUS_FLAGS = {
  ready:     { canSubmit: true,  canStop: false, canEditMessages: true  },
  submitted: { canSubmit: false, canStop: true,  canEditMessages: false },
  streaming: { canSubmit: false, canStop: true,  canEditMessages: false },
  error:     { canSubmit: true,  canStop: false, canEditMessages: false },
}

export const resolveStatus = (status) => STATUS_FLAGS[status] ?? STATUS_FLAGS.ready
