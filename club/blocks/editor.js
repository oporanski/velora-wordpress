/**
 * Gutenberg block editor UI for Velora Club Widgets.
 * Same architecture as the breeder plugin — placeholder in editor,
 * server-rendered shortcode on the front-end.
 */
(function (wp) {
  if (!wp || !wp.blocks || !wp.element) return;

  const { registerBlockType } = wp.blocks;
  const { createElement: el, Fragment } = wp.element;
  const { InspectorControls, useBlockProps } = wp.blockEditor || wp.editor;
  const { PanelBody, TextControl, TextareaControl, SelectControl, RangeControl, Placeholder } = wp.components;
  const { __ } = wp.i18n;

  const themeOptions = [
    { label: __('Auto', 'velora-club-widgets'), value: 'auto' },
    { label: __('Light', 'velora-club-widgets'), value: 'light' },
    { label: __('Dark', 'velora-club-widgets'), value: 'dark' },
  ];

  if (wp.blocks.getCategories && wp.blocks.setCategories) {
    var cats = wp.blocks.getCategories();
    if (!cats.find(function (c) { return c.slug === 'velora-club'; })) {
      wp.blocks.setCategories([{ slug: 'velora-club', title: __('Velora — Club', 'velora-club-widgets') }].concat(cats));
    }
  }

  function commonControls(props, opts) {
    const { attributes, setAttributes } = props;
    const controls = [
      el(TextControl, {
        label: __('Club slug (override)', 'velora-club-widgets'),
        help: __('Leave empty to use the default from plugin settings.', 'velora-club-widgets'),
        value: attributes.slug || '',
        onChange: function (v) { setAttributes({ slug: v }); },
      }),
      el(SelectControl, {
        label: __('Theme', 'velora-club-widgets'),
        value: attributes.theme || 'auto',
        options: themeOptions,
        onChange: function (v) { setAttributes({ theme: v }); },
      }),
    ];
    if (opts && opts.showLimit) {
      controls.unshift(
        el(RangeControl, {
          label: __('Limit', 'velora-club-widgets'),
          value: attributes.limit || opts.defaultLimit || 12,
          min: 1,
          max: 200,
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
      description: __('Velora embed widget — rendered on the front-end.', 'velora-club-widgets'),
      icon: opts.icon || 'groups',
      category: 'velora-club',
      supports: { html: false, align: ['wide', 'full'] },
      attributes: opts.attributes,
      edit: function (props) {
        const blockProps = useBlockProps ? useBlockProps({ className: 'velora-block-placeholder' }) : {};
        return el(Fragment, null,
          el(InspectorControls, null,
            el(PanelBody, { title: __('Settings', 'velora-club-widgets'), initialOpen: true },
              ...commonControls(props, opts),
              ...(opts.extraControls ? opts.extraControls(props) : [])
            )
          ),
          el('div', blockProps,
            el(Placeholder, {
              icon: opts.icon || 'groups',
              label: title,
              instructions: __('Live widget content appears on the published page. Use the panel on the right to configure.', 'velora-club-widgets'),
            },
              attrSummary(props.attributes)
                ? el('code', { style: { fontSize: '12px', opacity: 0.75 } }, attrSummary(props.attributes))
                : null
            )
          )
        );
      },
      save: function () { return null; },
    });
  }

  makeBlock('velora-club/about', __('Velora — About the club', 'velora-club-widgets'), {
    icon: 'info',
    attributes: { slug: { type: 'string', default: '' }, theme: { type: 'string', default: 'auto' } },
  });

  makeBlock('velora-club/breeders', __('Velora — Breeders', 'velora-club-widgets'), {
    icon: 'pets',
    showLimit: true, defaultLimit: 200,
    attributes: {
      slug: { type: 'string', default: '' },
      limit: { type: 'number', default: 200 },
      layout: { type: 'string', default: 'auto' },
      theme: { type: 'string', default: 'auto' },
    },
    extraControls: function (props) {
      return [
        el(SelectControl, {
          label: __('Layout', 'velora-club-widgets'),
          value: props.attributes.layout || 'auto',
          options: [
            { label: __('Auto (table for >20)', 'velora-club-widgets'), value: 'auto' },
            { label: __('Cards', 'velora-club-widgets'), value: 'cards' },
            { label: __('Table', 'velora-club-widgets'), value: 'table' },
          ],
          onChange: function (v) { props.setAttributes({ layout: v }); },
        }),
      ];
    },
  });

  makeBlock('velora-club/listings', __('Velora — Breeder listings', 'velora-club-widgets'), {
    icon: 'tag', showLimit: true, defaultLimit: 24,
    attributes: {
      slug: { type: 'string', default: '' },
      limit: { type: 'number', default: 24 },
      theme: { type: 'string', default: 'auto' },
    },
  });

  makeBlock('velora-club/posts', __('Velora — Club news', 'velora-club-widgets'), {
    icon: 'admin-post', showLimit: true, defaultLimit: 6,
    attributes: {
      slug: { type: 'string', default: '' },
      limit: { type: 'number', default: 6 },
      theme: { type: 'string', default: 'auto' },
    },
  });

  makeBlock('velora-club/events', __('Velora — Club shows', 'velora-club-widgets'), {
    icon: 'calendar-alt', showLimit: true, defaultLimit: 12,
    attributes: {
      slug: { type: 'string', default: '' },
      limit: { type: 'number', default: 12 },
      when: { type: 'string', default: 'upcoming' },
      show_filter: { type: 'string', default: 'true' },
      show_poster: { type: 'string', default: 'true' },
      theme: { type: 'string', default: 'auto' },
    },
    extraControls: function (props) {
      return [
        el(SelectControl, {
          label: __('When', 'velora-club-widgets'),
          value: props.attributes.when || 'upcoming',
          options: [
            { label: __('Upcoming', 'velora-club-widgets'), value: 'upcoming' },
            { label: __('Past', 'velora-club-widgets'), value: 'past' },
            { label: __('All', 'velora-club-widgets'), value: 'all' },
          ],
          onChange: function (v) { props.setAttributes({ when: v }); },
        }),
        el(SelectControl, {
          label: __('Show filter toolbar', 'velora-club-widgets'),
          value: props.attributes.show_filter || 'true',
          options: [
            { label: __('Show', 'velora-club-widgets'), value: 'true' },
            { label: __('Hide', 'velora-club-widgets'), value: 'false' },
          ],
          onChange: function (v) { props.setAttributes({ show_filter: v }); },
        }),
        el(SelectControl, {
          label: __('Show next event poster', 'velora-club-widgets'),
          value: props.attributes.show_poster || 'true',
          options: [
            { label: __('Show', 'velora-club-widgets'), value: 'true' },
            { label: __('Hide', 'velora-club-widgets'), value: 'false' },
          ],
          onChange: function (v) { props.setAttributes({ show_poster: v }); },
        }),
      ];
    },
  });

  makeBlock('velora-club/gallery', __('Velora — Gallery', 'velora-club-widgets'), {
    icon: 'format-gallery', showLimit: true, defaultLimit: 30,
    attributes: {
      slug: { type: 'string', default: '' },
      photos_per_album: { type: 'number', default: 30 },
      theme: { type: 'string', default: 'auto' },
    },
  });

  makeBlock('velora-club/documents', __('Velora — Documents', 'velora-club-widgets'), {
    icon: 'media-document', showLimit: true, defaultLimit: 100,
    attributes: {
      slug: { type: 'string', default: '' },
      limit: { type: 'number', default: 100 },
      theme: { type: 'string', default: 'auto' },
    },
  });

  makeBlock('velora-club/contact', __('Velora — Contact', 'velora-club-widgets'), {
    icon: 'email',
    attributes: { slug: { type: 'string', default: '' }, theme: { type: 'string', default: 'auto' } },
  });

  // Registered on its own rather than through makeBlock(): this block takes no
  // club slug and no limit, because it reads nothing from the API. What it does
  // take is wording, so the club can phrase the invitation in its own voice.
  registerBlockType('velora-club/member-area', {
    apiVersion: 2,
    title: __('Velora — Club members’ area', 'velora-club-widgets'),
    description: __('Static panel inviting club members to sign in to Velora. Makes no API request.', 'velora-club-widgets'),
    icon: 'lock',
    category: 'velora-club',
    supports: { html: false, align: ['wide', 'full'] },
    attributes: {
      heading: { type: 'string', default: '' },
      text: { type: 'string', default: '' },
      theme: { type: 'string', default: 'auto' },
    },
    edit: function (props) {
      const { attributes, setAttributes } = props;
      const blockProps = useBlockProps ? useBlockProps({ className: 'velora-block-placeholder' }) : {};
      return el(Fragment, null,
        el(InspectorControls, null,
          el(PanelBody, { title: __('Settings', 'velora-club-widgets'), initialOpen: true },
            el(TextControl, {
              label: __('Heading', 'velora-club-widgets'),
              help: __('Leave empty to use the built-in heading.', 'velora-club-widgets'),
              value: attributes.heading || '',
              onChange: function (v) { setAttributes({ heading: v }); },
            }),
            el(TextareaControl, {
              label: __('Text', 'velora-club-widgets'),
              help: __('Leave empty to use the built-in explanation of what Velora is.', 'velora-club-widgets'),
              value: attributes.text || '',
              onChange: function (v) { setAttributes({ text: v }); },
            }),
            el(SelectControl, {
              label: __('Theme', 'velora-club-widgets'),
              value: attributes.theme || 'auto',
              options: themeOptions,
              onChange: function (v) { setAttributes({ theme: v }); },
            })
          )
        ),
        el('div', blockProps,
          el(Placeholder, {
            icon: 'lock',
            label: __('Velora — Club members’ area', 'velora-club-widgets'),
            instructions: __('The sign-in panel appears on the published page. Use the panel on the right to reword it.', 'velora-club-widgets'),
          })
        )
      );
    },
    save: function () { return null; },
  });
})(window.wp);
