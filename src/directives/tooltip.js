export const vTooltip = {
  mounted(el, binding) {
    el.setAttribute('data-tooltip', binding.value)
    el.classList.add('tooltip-trigger')
  },
  updated(el, binding) {
    el.setAttribute('data-tooltip', binding.value)
  }
}