/**
 * Gutenberg block editor UI for Velora Breeder Widgets.
 *
 * Each block is server-rendered (PHP delegates to the existing shortcode).
 * The editor shows a static placeholder describing the widget; the actual
 * rendered HTML appears on the front-end. ServerSideRender was used
 * initially but had compatibility issues — placeholder is more robust
 * across WP versions and doesn't make the block "disappear" if the
 * REST request 401s.
 *
 * No build step — uses WordPress' bundled wp.* globals + plain JSX
 * via wp.element.createElement (aliased as `el` for brevity).
 */
(function (wp) {
  if (!wp || !wp.blocks || !wp.element) return;

  const { registerBlockType } = wp.blocks;
  const { createElement: el, Fragment } = wp.element;
  const { InspectorControls, useBlockProps } = wp.blockEditor || wp.editor;
  const { PanelBody, TextControl, SelectControl, RangeControl, Placeholder } = wp.components;
  const { __ } = wp.i18n;

  const themeOptions = [
    { label: __('Auto', 'velora-breeder-widgets'), value: 'auto' },
    { label: __('Light', 'velora-breeder-widgets'), value: 'light' },
    { label: __('Dark', 'velora-breeder-widgets'), value: 'dark' },
  ];

  // Register category if not already present.
  if (wp.blocks.getCategories && wp.blocks.setCategories) {
    var cats = wp.blocks.getCategories();
    if (!cats.find(function (c) { return c.slug === 'velora-breeder'; })) {
      wp.blocks.setCategories([{ slug: 'velora-breeder', title: __('Velora — Breeder', 'velora-breeder-widgets') }].concat(cats));
    }
  }

  function commonControls(props, opts) {
    const { attributes, setAttributes } = props;
    const controls = [
      el(TextControl, {
        label: __('Breeder slug (override)', 'velora-breeder-widgets'),
        help: __('Leave empty to use the default from plugin settings.', 'velora-breeder-widgets'),
        value: attributes.slug || '',
        onChange: function (v) { setAttributes({ slug: v }); },
      }),
      el(SelectControl, {
        label: __('Theme', 'velora-breeder-widgets'),
        value: attributes.theme || 'auto',
        options: themeOptions,
        onChange: function (v) { setAttributes({ theme: v }); },
      }),
    ];
    if (opts && opts.showLimit) {
      controls.unshift(
        el(RangeControl, {
          label: __('Limit', 'velora-breeder-widgets'),
          value: attributes.limit || opts.defaultLimit || 12,
          min: 1,
          max: 50,
          onChange: function (v) { setAttributes({ limit: v }); },
        })
      );
    }
    return controls;
  }

  function attrSummary(attrs) {
    const parts = [];
    if (attrs.slug) parts.push('slug="' + attrs.slug + '"');
    if (attrs.limit) parts.push('limit=' + attrs.limit);
    if (attrs.when) parts.push('when="' + attrs.when + '"');
    if (attrs.layout && attrs.layout !== 'auto') parts.push('layout="' + attrs.layout + '"');
    if (attrs.theme && attrs.theme !== 'auto') parts.push('theme="' + attrs.theme + '"');
    return parts.length ? parts.join(' · ') : '';
  }

  function makeBlock(name, title, opts) {
    registerBlockType(name, {
      apiVersion: 2,
      title: title,
      description: __('Velora embed widget — rendered on the front-end.', 'velora-breeder-widgets'),
      icon: opts.icon || 'pets',
      category: 'velora-breeder',
      supports: { html: false, align: ['wide', 'full'] },
      attributes: opts.attributes,
      edit: function (props) {
        const blockProps = useBlockProps ? useBlockProps({ className: 'velora-block-placeholder' }) : {};
        return el(Fragment, null,
          el(InspectorControls, null,
            el(PanelBody, { title: __('Settings', 'velora-breeder-widgets'), initialOpen: true },
              ...commonControls(props, opts),
              ...(opts.extraControls ? opts.extraControls(props) : [])
            )
          ),
          el('div', blockProps,
            el(Placeholder, {
              icon: opts.icon || 'pets',
              label: title,
              instructions: __('Live widget content appears on the published page. Use the panel on the right to configure.', 'velora-breeder-widgets'),
            },
              attrSummary(props.attributes)
                ? el('code', { style: { fontSize: '12px', opacity: 0.75 } }, attrSummary(props.attributes))
                : null
            )
          )
        );
      },
      save: function () { return null; }, // dynamic / server-rendered
    });
  }

  // ── Block definitions ─────────────────────────────────────────────────────

  makeBlock('velora-breeder/about', __('Velora — About the breeder', 'velora-breeder-widgets'), {
    icon: 'info',
    attributes: { slug: { type: 'string', default: '' }, theme: { type: 'string', default: 'auto' } },
  });

  makeBlock('velora-breeder/animals', __('Velora — Animals', 'velora-breeder-widgets'), {
    icon: 'pets',
    showLimit: true, defaultLimit: 12,
    attributes: {
      slug: { type: 'string', default: '' },
      limit: { type: 'number', default: 12 },
      theme: { type: 'string', default: 'auto' },
    },
  });

  makeBlock('velora-breeder/gallery', __('Velora — Gallery', 'velora-breeder-widgets'), {
    icon: 'format-gallery',
    showLimit: true, defaultLimit: 24,
    attributes: {
      slug: { type: 'string', default: '' },
      limit: { type: 'number', default: 24 },
      theme: { type: 'string', default: 'auto' },
    },
  });

  makeBlock('velora-breeder/listings', __('Velora — Listings', 'velora-breeder-widgets'), {
    icon: 'tag',
    showLimit: true, defaultLimit: 12,
    attributes: {
      slug: { type: 'string', default: '' },
      limit: { type: 'number', default: 12 },
      theme: { type: 'string', default: 'auto' },
    },
  });

  makeBlock('velora-breeder/posts', __('Velora — News', 'velora-breeder-widgets'), {
    icon: 'admin-post',
    showLimit: true, defaultLimit: 6,
    attributes: {
      slug: { type: 'string', default: '' },
      limit: { type: 'number', default: 6 },
      theme: { type: 'string', default: 'auto' },
    },
  });

  makeBlock('velora-breeder/events', __('Velora — Shows', 'velora-breeder-widgets'), {
    icon: 'calendar-alt',
    showLimit: true, defaultLimit: 12,
    attributes: {
      slug: { type: 'string', default: '' },
      limit: { type: 'number', default: 12 },
      when: { type: 'string', default: 'upcoming' },
      show_filter: { type: 'string', default: 'true' },
      theme: { type: 'string', default: 'auto' },
    },
    extraControls: function (props) {
      return [
        el(SelectControl, {
          label: __('When', 'velora-breeder-widgets'),
          value: props.attributes.when || 'upcoming',
          options: [
            { label: __('Upcoming', 'velora-breeder-widgets'), value: 'upcoming' },
            { label: __('Past', 'velora-breeder-widgets'), value: 'past' },
            { label: __('All', 'velora-breeder-widgets'), value: 'all' },
          ],
          onChange: function (v) { props.setAttributes({ when: v }); },
        }),
        el(SelectControl, {
          label: __('Show filter toolbar', 'velora-breeder-widgets'),
          value: props.attributes.show_filter || 'true',
          options: [
            { label: __('Show', 'velora-breeder-widgets'), value: 'true' },
            { label: __('Hide', 'velora-breeder-widgets'), value: 'false' },
          ],
          onChange: function (v) { props.setAttributes({ show_filter: v }); },
        }),
      ];
    },
  });

  makeBlock('velora-breeder/contact', __('Velora — Contact', 'velora-breeder-widgets'), {
    icon: 'email',
    attributes: {
      slug: { type: 'string', default: '' },
      theme: { type: 'string', default: 'auto' },
    },
  });
})(window.wp);
