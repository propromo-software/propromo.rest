import { Octokit } from "octokit";

const CREATE_LABEL_MUTATION = `
  mutation CreateLabel($repositoryId: ID!, $name: String!, $description: String, $color: String!) {
    createLabel(input: {
      repositoryId: $repositoryId,
      name: $name,
      description: $description,
      color: $color
    }) {
      label {
        id
        name
      }
    }
  }
`;

export async function handleProjectItemChange(
  octokit: Octokit,
  projectItem: {
    id: string,
    content: { id: string },
    fieldValues: {
      nodes: Array<{
        field: { name: string },
        value: string | null
      }>
    }
  }
) {
  const result: { type: string, actions: any[] } = {
    type: 'project_item_change',
    actions: []
  };

  const iterationField = projectItem.fieldValues.nodes.find(
    node => node.field.name.toLowerCase() === 'sprint'
  );

  result.actions.push({
    type: 'field_check',
    sprintField: iterationField?.value
  });

  const issueData = await octokit.graphql(`
    query($nodeId: ID!) {
      node(id: $nodeId) {
        ... on Issue {
          repository {
            id
          }
          labels(first: 100) {
            nodes {
              id
              name
            }
          }
        }
      }
    }
  `, {
    nodeId: projectItem.content.id
  });

  const labelInfo = await createSprintLabel(
    octokit,
    projectItem.content.id,
    issueData.node.repository.id,
    iterationField || { field: { name: 'Sprint' }, value: null },
    issueData
  );

  result.actions.push({
    type: 'label_processing',
    ...labelInfo
  });

  return result;
}

async function createSprintLabel(
  octokit: Octokit,
  issueNodeId: string,
  repositoryId: string,
  iterationField: { field: { name: string }, value: string | null },
  issueData: any
) {
  const info: any = {
    sprintValue: iterationField.value,
    actions: []
  };

  if (!iterationField.value) {
    const sprintLabels = issueData.node.labels.nodes
      .filter((label: { name: string }) => {
        const isSprintLabel = label.name.startsWith('sprint-');
        info.actions.push({
          type: 'check_label',
          name: label.name,
          isSprintLabel
        });
        return isSprintLabel;
      })
      .map((label: { id: string }) => {
        info.actions.push({
          type: 'prepare_remove',
          labelId: label.id
        });
        return label.id;
      })
      .filter((id: any) => id != null);

    if (sprintLabels.length > 0) {
      try {
        await octokit.graphql(`
          mutation($issueId: ID!, $labelIds: [ID!]!) {
            removeLabelsFromLabelable(input: {
              labelableId: $issueId,
              labelIds: $labelIds
            }) {
              clientMutationId
            }
          }
        `, {
          issueId: issueNodeId,
          labelIds: sprintLabels
        });
        info.actions.push({
          type: 'remove_labels',
          success: true,
          removedLabels: sprintLabels
        });
      } catch (error) {
        info.actions.push({
          type: 'remove_labels',
          success: false,
          error: typeof error === 'object' && error !== null && 'message' in error ? (error as any).message : 'Unknown error'
        });
        throw error;
      }
    }
    return info;
  }

  const sprintNumber = extractSprintNumber(iterationField.value);
  if (!sprintNumber) return info;

  const labelName = `sprint-${sprintNumber.toLowerCase()}`;

  const existingLabels = await octokit.graphql(`
    query($repositoryId: ID!, $labelName: String!) {
      node(id: $repositoryId) {
        ... on Repository {
          label(name: $labelName) {
            id
          }
        }
      }
    }
  `, {
    repositoryId,
    labelName
  });

  let labelId;
  if (!existingLabels.node.label) {
    info.actions.push({
      type: 'create_label',
      name: labelName,
      description: "sprint info",
      color: "ffffff"
    });
    const newLabel = await octokit.graphql(CREATE_LABEL_MUTATION, {
      repositoryId,
      name: labelName,
      description: "sprint info",
      color: "ffffff"
    });
    labelId = newLabel.createLabel.label.id;
  } else {
    labelId = existingLabels.node.label.id;
  }

  if (!labelId) {
    info.actions.push({
      type: 'error',
      message: 'No valid label ID found'
    });
    return info;
  }

  await octokit.graphql(`
    mutation($issueId: ID!, $labelIds: [ID!]!) {
      addLabelsToLabelable(input: {
        labelableId: $issueId,
        labelIds: $labelIds
      }) {
        clientMutationId
      }
    }
  `, {
    issueId: issueNodeId,
    labelIds: [labelId]
  });

  return info;
}

function extractSprintNumber(sprintName: string): string {
  const match = sprintName.match(/Sprint\s+(\d+)/i);
  if (!match) return '';
  
  const num = parseInt(match[1]);
  return num < 10 ? `0${num}` : `${num}`;
}
