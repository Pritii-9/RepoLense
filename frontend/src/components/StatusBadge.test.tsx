import { render } from '@testing-library/react'

import { StatusBadge } from '@/components/StatusBadge'

describe('StatusBadge', () => {
  it('renders a friendly label for the status', () => {
    const { getByText } = render(<StatusBadge status="completed" />)

    expect(getByText('Completed')).toBeInTheDocument()
  })

  it('applies the expected style classes for failed analyses', () => {
    const { getByText } = render(<StatusBadge status="failed" />)

    expect(getByText('Failed')).toHaveClass('bg-rose-50', 'text-rose-700')
  })
})
