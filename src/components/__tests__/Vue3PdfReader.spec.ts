import { describe, it, expect } from 'vitest'

import { mount } from '@vue/test-utils'
import Vue3PdfReader from '../Vue3PdfReader.vue'

describe('Vue3PdfReader', () => {
  it('renders properly', () => {
    const wrapper = mount(Vue3PdfReader)
    expect(wrapper.exists()).equals(true)
  })
})
